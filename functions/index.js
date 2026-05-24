/**
 * Firebase Cloud Functions
 *
 * - sendPushToUser — FCM web push (Bearer PUSH_WEBHOOK_SECRET)
 * - submitPublicViewingBooking — customer book-a-viewing POST → Sanity `vehicle.viewing_bookings`
 *
 * Shared env: SANITY_PROJECT_ID, SANITY_DATASET (default production), SANITY_API_TOKEN with needed scopes.
 * Optional for public booking: PUBLIC_BOOKING_ALLOWED_ORIGINS (comma-separated URL prefixes).
 *
 * Example FCM:
 *   curl -X POST "$FUNCTION_URL" \
 *     -H "Authorization: Bearer $PUSH_WEBHOOK_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"firebase_uid":"...","title":"New task","body":"You have a prep step.","path":"/app/my-work"}'
 */

const { onRequest } = require('firebase-functions/v2/https')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')
const { createClient } = require('@sanity/client')

if (!admin.apps.length) {
  admin.initializeApp()
}

function sanityClient() {
  const projectId = process.env.SANITY_PROJECT_ID
  const dataset = process.env.SANITY_DATASET || 'production'
  const token = process.env.SANITY_API_TOKEN
  if (!projectId || !token) {
    throw new Error('Missing SANITY_PROJECT_ID or SANITY_API_TOKEN')
  }
  return createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2024-01-01',
    useCdn: false,
  })
}

exports.sendPushToUser = onRequest(
  {
    region: 'us-central1',
    cors: false,
    invoker: 'public',
    timeoutSeconds: 60,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }

    const expected = process.env.PUSH_WEBHOOK_SECRET
    const auth = req.get('authorization') || ''
    if (!expected || auth !== `Bearer ${expected}`) {
      res.status(401).send('Unauthorized')
      return
    }

    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        res.status(400).send('Invalid JSON body')
        return
      }
    }

    const firebaseUid = body?.firebase_uid
    const title = String(body?.title || 'Notification').slice(0, 120)
    const bodyText = String(body?.body || '').slice(0, 500)
    let path = String(body?.path || '/app/notifications').slice(0, 500)
    if (!path.startsWith('/')) path = `/${path}`

    if (!firebaseUid) {
      res.status(400).send('firebase_uid required')
      return
    }

    let sanity
    try {
      sanity = sanityClient()
    } catch (e) {
      logger.error(e)
      res.status(500).send('Server misconfigured')
      return
    }

    const doc = await sanity.fetch(
      `*[_type == "userProfile" && firebase_uid == $u][0]{ _id, fcm_web_tokens }`,
      { u: firebaseUid }
    )
    const profileId = doc?._id
    const tokens = Array.isArray(doc?.fcm_web_tokens) ? [...new Set(doc.fcm_web_tokens.filter(Boolean))] : []

    if (!tokens.length) {
      res.json({ ok: true, sent: 0, message: 'No FCM tokens for user' })
      return
    }

    const message = {
      tokens,
      notification: { title, body: bodyText },
      data: { path },
    }

    try {
      const resp = await admin.messaging().sendEachForMulticast(message)
      const invalid = []
      resp.responses.forEach((r, i) => {
        if (!r.success && r.error) {
          const code = r.error.code
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalid.push(tokens[i])
          }
        }
      })

      if (invalid.length && profileId) {
        const next = tokens.filter((t) => !invalid.includes(t))
        try {
          await sanity.patch(profileId).set({ fcm_web_tokens: next }).commit()
        } catch (e) {
          logger.warn('Could not prune invalid FCM tokens', e)
        }
      }

      res.json({
        ok: true,
        sent: resp.successCount,
        failed: resp.failureCount,
        pruned: invalid.length,
      })
    } catch (e) {
      logger.error(e)
      res.status(500).send('FCM send failed')
    }
  }
)

// --- Public viewing requests (writes vehicle.viewing_bookings via server token)

function newPublicViewingKey() {
  const crypto = require('crypto')
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

/** Strip dangerous / odd characters — no HTML, no controls */
function plainTextBooking(s, max) {
  if (s == null) return ''
  let t = String(s)
    .normalize('NFKC')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  t = t.replace(/</g, '').replace(/>/g, '')
  t = t.replace(/\s+/g, ' ')
  return t.trim().slice(0, max)
}

function sanitizeBookingPhone(raw, max = 40) {
  let t = plainTextBooking(raw, max)
  t = t.replace(/[^\d+\s().-]/g, '')
  return t.trim().slice(0, max)
}

function sanitizeBookingEmail(raw, max = 160) {
  const e = plainTextBooking(raw, max).toLowerCase()
  if (!e) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return ''
  return e.slice(0, max)
}

function digitsOnlyCount(s) {
  return (String(s || '').match(/\d/g) || []).length
}

function bookingOriginAllowed(req) {
  const list = process.env.PUBLIC_BOOKING_ALLOWED_ORIGINS
  if (!list || !String(list).trim()) return true
  const origin = req.get('Origin') || ''
  const referer = req.get('Referer') || ''
  const allowed = String(list)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  if (!allowed.length) return true
  return allowed.some((a) => {
    if (!a) return false
    try {
      if (origin && origin.startsWith(a)) return true
      if (referer && referer.startsWith(a)) return true
    } catch {
      /* ignore */
    }
    return false
  })
}

exports.submitPublicViewingBooking = onRequest(
  {
    region: 'us-central1',
    cors: true,
    invoker: 'public',
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' })
      return
    }

    if (!bookingOriginAllowed(req)) {
      logger.warn('Public booking blocked origin', {
        origin: req.get('Origin'),
        referer: req.get('Referer'),
      })
      res.status(403).json({ ok: false, error: 'Forbidden' })
      return
    }

    let body = req.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        res.status(400).json({ ok: false, error: 'Invalid JSON' })
        return
      }
    }

    if (body?.hp_company && String(body.hp_company).trim()) {
      logger.info('Public booking honeypot filled')
      res.json({ ok: true, accepted: true })
      return
    }

    const vehicleId = plainTextBooking(body?.vehicleId, 120)
    if (!vehicleId || !/^[\w.-]+$/.test(vehicleId)) {
      res.status(400).json({ ok: false, error: 'Invalid request' })
      return
    }

    const customer_name = plainTextBooking(body?.customer_name, 120)
    if (customer_name.length < 2) {
      res.status(400).json({ ok: false, error: 'Please enter your name.' })
      return
    }

    const customer_phone = sanitizeBookingPhone(body?.customer_phone, 40)
    if (digitsOnlyCount(customer_phone) < 7) {
      res.status(400).json({ ok: false, error: 'Please enter a valid phone number.' })
      return
    }

    const customer_email = sanitizeBookingEmail(body?.customer_email, 160)
    const notesRaw = plainTextBooking(body?.notes, 1200)
    const notes = notesRaw ? `[Public link] ${notesRaw}` : '[Public link]'

    const scheduled_at = plainTextBooking(body?.scheduled_at, 64)
    const d = new Date(scheduled_at)
    if (Number.isNaN(d.getTime())) {
      res.status(400).json({ ok: false, error: 'Invalid date and time.' })
      return
    }

    const now = Date.now()
    if (d.getTime() < now - 120 * 1000) {
      res.status(400).json({ ok: false, error: 'Please choose a future date and time.' })
      return
    }
    if (d.getTime() > now + 91 * 24 * 60 * 60 * 1000) {
      res.status(400).json({ ok: false, error: 'That date is too far ahead.' })
      return
    }

    let sanity
    try {
      sanity = sanityClient()
    } catch (e) {
      logger.error(e)
      res.status(500).json({ ok: false, error: 'Server misconfigured' })
      return
    }

    const v = await sanity.fetch(
      `*[_type == "vehicle" && _id == $id][0]{ viewing_bookings, reserved, sold }`,
      { id: vehicleId }
    )

    if (!v) {
      res.status(404).json({ ok: false, error: 'Vehicle not found.' })
      return
    }
    if (v.sold === true) {
      res.status(400).json({ ok: false, error: 'This vehicle is no longer available for viewings.' })
      return
    }
    if (v.reserved === true) {
      res.status(400).json({ ok: false, error: 'This vehicle is reserved.' })
      return
    }

    const existing = Array.isArray(v.viewing_bookings) ? v.viewing_bookings : []
    const _key = newPublicViewingKey()
    const row = {
      _key,
      customer_name,
      customer_phone,
      customer_email,
      scheduled_at,
      notes,
      status: 'scheduled',
      staff_message: 'Customer requested a viewing via the public share link.',
      mentioned_firebase_uids: [],
      notify_managers: true,
      staff_alert_cleared_uids: [],
      created_at: new Date().toISOString(),
      created_by_uid: '',
      created_by_name: 'Customer (booking link)',
    }

    try {
      await sanity
        .patch(vehicleId)
        .set({
          viewing_bookings: [...existing, row],
          updated_at: new Date().toISOString(),
        })
        .commit()
      res.json({ ok: true })
    } catch (e) {
      logger.error(e)
      res.status(500).json({ ok: false, error: 'Could not save booking. Try again later.' })
    }
  }
)
