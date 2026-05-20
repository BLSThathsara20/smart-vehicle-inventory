#!/usr/bin/env node
/**
 * Fix in-app RBAC on the Sanity dataset (not the sanity.io/manage "Administrators").
 *
 * Usage:
 *   node scripts/sanity-assign-app-role.mjs --email=user@gmail.com --role=admin
 *   node scripts/sanity-assign-app-role.mjs --firebase-uid=FIREBASE_AUTH_UID --role=super_admin
 *
 * Roles: guest | helper | marketer | worker | manager | mechanic | viewer | admin | super_admin
 *
 * Env: SANITY_PROJECT_ID / SANITY_DATASET / SANITY_TOKEN, or copy from .env as VITE_SANITY_*
 */

import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function loadDotEnv(filePath) {
	try {
		const raw = fs.readFileSync(filePath, 'utf8')
		for (const line of raw.split('\n')) {
			const t = line.trim()
			if (!t || t.startsWith('#')) continue
			const eq = t.indexOf('=')
			if (eq < 1) continue
			const key = t.slice(0, eq).trim()
			let val = t.slice(eq + 1).trim()
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
				val = val.slice(1, -1)
			}
			if (process.env[key] === undefined) process.env[key] = val
		}
	} catch {
		/* ignore */
	}
}

loadDotEnv(path.join(ROOT, '.env'))

function env(name, viteName) {
	return (process.env[name] || process.env[viteName] || '').trim()
}

const ROLE_MAP = {
	guest: 'role-guest',
	helper: 'role-helper',
	marketer: 'role-marketer',
	worker: 'role-worker',
	manager: 'role-manager',
	mechanic: 'role-mechanic',
	viewer: 'role-viewer',
	admin: 'role-admin',
	super_admin: 'role-super-admin',
}

function userProfileDocId(firebaseUid) {
	const safe = String(firebaseUid || '').replace(/[^a-zA-Z0-9_.-]/g, '-')
	return `userProfile.${safe}`
}

function parseArgs(argv) {
	const out = { role: 'admin', email: null, firebaseUid: null, dryRun: false, help: false }
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i]
		if (a === '--dry-run') out.dryRun = true
		else if (a.startsWith('--email=')) out.email = a.slice('--email='.length).trim().toLowerCase()
		else if (a.startsWith('--firebase-uid=')) out.firebaseUid = a.slice('--firebase-uid='.length).trim()
		else if (a.startsWith('--role=')) out.role = a.slice('--role='.length).trim().toLowerCase()
		else if (a === '--help' || a === '-h') out.help = true
	}
	return out
}

const args = parseArgs(process.argv)

if (args.help) {
	console.log(`Usage:
  node scripts/sanity-assign-app-role.mjs --email=user@example.com --role=admin
  node scripts/sanity-assign-app-role.mjs --firebase-uid=FIREBASE_AUTH_UID --role=super_admin

Roles: ${Object.keys(ROLE_MAP).join(' | ')}
`)
	process.exit(0)
}

const projectId = env('SANITY_PROJECT_ID', 'VITE_SANITY_PROJECT_ID')
const dataset = env('SANITY_DATASET', 'VITE_SANITY_DATASET') || 'production'
const apiVersion = env('SANITY_API_VERSION', 'VITE_SANITY_API_VERSION') || '2024-01-01'
const token = env('SANITY_TOKEN', 'VITE_SANITY_TOKEN')

if (!projectId || !dataset || !token) {
	console.error('Missing Sanity env. Set SANITY_PROJECT_ID / SANITY_DATASET / SANITY_TOKEN (or VITE_* in .env).')
	process.exit(1)
}

const roleSlug = ROLE_MAP[args.role]
if (!roleSlug) {
	console.error(`Unknown role "${args.role}". Use one of: ${Object.keys(ROLE_MAP).join(', ')}`)
	process.exit(1)
}

if (!args.email && !args.firebaseUid) {
	console.error('Provide --email=... or --firebase-uid=... (Firebase Auth → Users → UID).')
	process.exit(1)
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

const roleCheck = await client.fetch(`count(*[_type == "role" && _id == $id])`, { id: roleSlug })
if (roleCheck === 0) {
	console.error(
		`Sanity role "${roleSlug}" not found in dataset. Have any user open the inventory app once (with valid token/CORS)` +
			' so RBAC bootstrap can create roles.',
	)

	process.exit(1)
}

async function findProfiles() {
	if (args.firebaseUid) {
		return (
			await client.fetch(
				`*[_type == "userProfile" && firebase_uid == $uid]{ _id, firebase_uid, email, "roleRef": role._ref }`,
				{ uid: args.firebaseUid },
			).catch(() => [])
		)
	}
	return (
		await client.fetch(`*[_type == "userProfile" && lower(email) == lower($email)]{_id, firebase_uid, email, "roleRef": role._ref}`, {
			email: args.email.trim().toLowerCase(),
		}).catch(() => [])
	)
}

/** Keep first profile document, delete extras (aligned with browser bootstrap). */
async function dedupeToOne(rows) {
	if (!rows?.length) return null
	const sorted = [...rows].sort((a, b) => String(a._id).localeCompare(String(b._id)))
	const keep = sorted[0]
	for (let i = 1; i < sorted.length; i++) {
		console.warn('Removing duplicate userProfile:', sorted[i]._id)
		if (!args.dryRun) await client.delete(sorted[i]._id).catch((e) => console.warn(String(e.message || e)))
	}
	return keep
}

const rows = await findProfiles()
let profile = await dedupeToOne(rows)

if (!profile && args.firebaseUid) {
	const _id = userProfileDocId(args.firebaseUid)
	console.log(`No userProfile; creating ${_id}`)
	if (!args.dryRun) {
		await client.createIfNotExists({
			_id,
			_type: 'userProfile',
			firebase_uid: args.firebaseUid,
			email: '',
			display_name: '',
			role: { _type: 'reference', _ref: roleSlug },
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
	}
	profile = { _id, firebase_uid: args.firebaseUid, email: '', roleRef: roleSlug }
} else if (!profile) {
	console.error(
		'No Sanity userProfile row for that email.\n→ In Firebase Console open Authentication → copy the UID for that Gmail.\n→ Then run:',
	)
	console.error(
		`  node scripts/sanity-assign-app-role.mjs --firebase-uid=PASTE_UID_HERE --role=super_admin`,
	)
	process.exit(1)
}

console.log(`Patch ${profile._id} (uid=${profile.firebase_uid || '—'}, email=${profile.email || '—'}) → ${roleSlug}`)

try {
	if (!args.dryRun) {
		await client
			.patch(profile._id)
			.set({
				role: { _type: 'reference', _ref: roleSlug },
				updated_at: new Date().toISOString(),
			})
			.commit()
	}
} catch (e) {
	const code = e?.statusCode ?? e?.response?.statusCode
	if (code === 403) {
		console.error(
			'Sanity returned 403: token cannot update documents.\n' +
				'Create token with Editor: sanity.io/manage → project → API → Add API token → Editor.',
		)
	} else {
		console.error(e?.message || e)
	}

	process.exit(1)
}

console.log('Done. Refresh the app or sign out and back in.')
