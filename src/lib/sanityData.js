import { sanity } from "./sanity";
import { vehicleMeetsApplyWhen } from "./workflowApplyRules";
import {
	validateWorkPathDeadlineVsPlannedCollection,
	validateWorkPathDeadlineNotInPast,
} from "./workPathDeadlineRules.js";
import { deserializePdiFromStorage, serializePdiForStorage } from "./pdiInspectionModel.js";
import {
	verificationMatches,
	pickupNeedsPlateOrStockVerification,
	sanitizeCustomerCollectionNote,
} from "./pickupVerification";

/** Permission bundles for seeded / ensured built-in roles (single source of truth). */
const PERMS_GUEST = ["perm-inventory-view"];
const PERMS_HELPER = [
	"perm-inventory-view",
	"perm-search-view",
	"perm-settings-view",
];
const PERMS_MARKETER = [
	"perm-inventory-view",
	"perm-inventory-edit",
	"perm-search-view",
	"perm-settings-view",
];
const PERMS_WORKER = [
	"perm-inventory-view",
	"perm-inventory-add",
	"perm-inventory-edit",
	"perm-search-view",
	"perm-settings-view",
];
const PERMS_MANAGER = [
	"perm-inventory-view",
	"perm-inventory-add",
	"perm-inventory-edit",
	"perm-inventory-delete",
	"perm-search-view",
	"perm-health-view",
	"perm-space-view",
	"perm-settings-view",
];

/** Keeps built-in guest role in sync (inventory view only). Safe to call on every bootstrap. */
async function syncBuiltinGuestRole() {
	if (!sanity) return;
	await sanity.createOrReplace({
		_id: "role-guest",
		_type: "role",
		name: "guest",
		description: "Default for new sign-ins: view inventory only (no edits)",
		is_system: true,
		permission_ids: PERMS_GUEST,
	});
}

/** Ensures manager / worker / helper / marketer exist on existing datasets without overwriting edits. */
async function ensureExtendedBuiltinRoles() {
	if (!sanity) return;
	const defs = [
		{
			_id: "role-manager",
			name: "manager",
			description:
				"Operations lead: full inventory, search, notifications, health & storage (no user/role admin)",
			permission_ids: PERMS_MANAGER,
		},
		{
			_id: "role-worker",
			name: "worker",
			description: "Floor staff: add and update vehicles, search & settings",
			permission_ids: PERMS_WORKER,
		},
		{
			_id: "role-helper",
			name: "helper",
			description: "Support: browse inventory and search (no edits)",
			permission_ids: PERMS_HELPER,
		},
		{
			_id: "role-marketer",
			name: "marketer",
			description: "Listings & ads: view inventory, edit vehicles, search",
			permission_ids: PERMS_MARKETER,
		},
	];
	for (const d of defs) {
		await sanity.createIfNotExists({
			_id: d._id,
			_type: "role",
			name: d.name,
			description: d.description,
			is_system: false,
			permission_ids: d.permission_ids,
		});
	}
}

const BOOTSTRAP_SKIP_UNTIL_KEY = "vi-bootstrap-skip-until";

export async function ensureBootstrap() {
	if (!sanity) return;
	try {
		const until = Number(
			sessionStorage.getItem(BOOTSTRAP_SKIP_UNTIL_KEY) || "0",
		);
		if (until > Date.now()) return;
	} catch {
		/* private mode */
	}
	const count = await sanity.fetch('count(*[_type == "permission"])');

	let bootstrapMutationsOk = false;
	try {
		if (count === 0) {
		const permissions = [
			{
				_id: "perm-inventory-view",
				code: "inventory:view",
				label: "View inventory",
				category: "Inventory",
				sort_order: 1,
			},
			{
				_id: "perm-inventory-add",
				code: "inventory:add",
				label: "Add vehicles",
				category: "Inventory",
				sort_order: 2,
			},
			{
				_id: "perm-inventory-edit",
				code: "inventory:edit",
				label: "Edit vehicles",
				category: "Inventory",
				sort_order: 3,
			},
			{
				_id: "perm-inventory-delete",
				code: "inventory:delete",
				label: "Delete vehicles",
				category: "Inventory",
				sort_order: 4,
			},
			{
				_id: "perm-search-view",
				code: "search:view",
				label: "Search vehicles",
				category: "Search",
				sort_order: 10,
			},
			{
				_id: "perm-health-view",
				code: "health:view",
				label: "View app health",
				category: "System",
				sort_order: 20,
			},
			{
				_id: "perm-space-view",
				code: "space:view",
				label: "View storage & space",
				category: "System",
				sort_order: 21,
			},
			{
				_id: "perm-settings-view",
				code: "settings:view",
				label: "View settings",
				category: "System",
				sort_order: 22,
			},
			{
				_id: "perm-roles-manage",
				code: "roles:manage",
				label: "Manage roles & permissions",
				category: "Admin",
				sort_order: 30,
			},
			{
				_id: "perm-users-manage",
				code: "users:manage",
				label: "Manage users",
				category: "Admin",
				sort_order: 31,
			},
			{
				_id: "perm-workflows-create",
				code: "workflows:create",
				label: "Create work paths",
				category: "Admin",
				sort_order: 32,
			},
			{
				_id: "perm-workflows-edit",
				code: "workflows:edit",
				label: "Edit work paths",
				category: "Admin",
				sort_order: 33,
			},
			{
				_id: "perm-workflows-manage",
				code: "workflows:manage",
				label: "Work paths (full: create & edit)",
				category: "Admin",
				sort_order: 34,
			},
			{
				_id: "perm-analytics-view",
				code: "analytics:view",
				label: "View analytics",
				category: "Admin",
				sort_order: 35,
			},
		];

		const allIds = permissions.map((p) => p._id);
		const noUsersManage = allIds.filter((id) => id !== "perm-users-manage");
		const mechanicIds = PERMS_WORKER;
		const viewerIds = PERMS_HELPER;

		const roles = [
			{
				_id: "role-super-admin",
				name: "super_admin",
				description: "Full system access",
				is_system: true,
				permission_ids: allIds,
			},
			{
				_id: "role-admin",
				name: "admin",
				description: "Administrative access",
				is_system: false,
				permission_ids: noUsersManage,
			},
			{
				_id: "role-mechanic",
				name: "mechanic",
				description: "Vehicle maintenance & inventory",
				is_system: false,
				permission_ids: mechanicIds,
			},
			{
				_id: "role-viewer",
				name: "viewer",
				description: "Read-only search & inventory",
				is_system: false,
				permission_ids: viewerIds,
			},
			{
				_id: "role-guest",
				name: "guest",
				description: "Default for new sign-ins: view inventory only (no edits)",
				is_system: true,
				permission_ids: PERMS_GUEST,
			},
			{
				_id: "role-manager",
				name: "manager",
				description:
					"Operations lead: full inventory, search, notifications, health & storage (no user/role admin)",
				is_system: false,
				permission_ids: PERMS_MANAGER,
			},
			{
				_id: "role-worker",
				name: "worker",
				description: "Floor staff: add and update vehicles, search & settings",
				is_system: false,
				permission_ids: PERMS_WORKER,
			},
			{
				_id: "role-helper",
				name: "helper",
				description: "Support: browse inventory and search (no edits)",
				is_system: false,
				permission_ids: PERMS_HELPER,
			},
			{
				_id: "role-marketer",
				name: "marketer",
				description: "Listings & ads: view inventory, edit vehicles, search",
				is_system: false,
				permission_ids: PERMS_MARKETER,
			},
		];

		for (const p of permissions) {
			await sanity.createOrReplace({ _type: "permission", ...p });
		}
		for (const r of roles) {
			const { permission_ids, ...rest } = r;
			await sanity.createOrReplace({ _type: "role", ...rest, permission_ids });
		}
		}
		await syncBuiltinGuestRole();
		await ensureExtendedBuiltinRoles();
		await ensureWorkflowsPermission();
		await ensureAnalyticsPermission();
		await ensurePredefinedWorkPaths();
		bootstrapMutationsOk = true;
	} catch (e) {
		console.warn(
			"[vehicle-identifier] Sanity bootstrap mutations skipped (token may be read-only — use Editor token to seed/update RBAC). Profile load continues.",
			e?.message || e,
		);
	}

	if (bootstrapMutationsOk) {
		try {
			sessionStorage.setItem(
				BOOTSTRAP_SKIP_UNTIL_KEY,
				String(Date.now() + 45 * 60 * 1000),
			);
		} catch {
			/* ignore */
		}
	}
}

/** Ensure work path permission docs exist and legacy admin roles retain access (manage and/or create+edit). */
async function ensureWorkflowsPermission() {
	if (!sanity) return;
	const perms = [
		{
			_id: "perm-workflows-create",
			_type: "permission",
			code: "workflows:create",
			label: "Create work paths",
			category: "Admin",
			sort_order: 32,
		},
		{
			_id: "perm-workflows-edit",
			_type: "permission",
			code: "workflows:edit",
			label: "Edit work paths",
			category: "Admin",
			sort_order: 33,
		},
		{
			_id: "perm-workflows-manage",
			_type: "permission",
			code: "workflows:manage",
			label: "Work paths (full: create & edit)",
			category: "Admin",
			sort_order: 34,
		},
	];
	for (const p of perms) {
		await sanity.createIfNotExists(p);
	}
	const pidManage = "perm-workflows-manage";
	const pidCreate = "perm-workflows-create";
	const pidEdit = "perm-workflows-edit";
	for (const rid of ["role-super-admin", "role-admin"]) {
		const role = await sanity.fetch(`*[_id == $id][0]{ permission_ids }`, {
			id: rid,
		});
		const raw = role?.permission_ids;
		const ids = Array.isArray(raw)
			? raw.map((x) =>
					typeof x === "string" ? x : x?._ref || x?.ref || String(x),
				)
			: [];
		const toAdd = [pidCreate, pidEdit, pidManage].filter(
			(p) => !ids.includes(p),
		);
		if (toAdd.length) {
			await sanity
				.patch(rid)
				.set({ permission_ids: [...ids, ...toAdd] })
				.commit();
		}
	}
}

/** Analytics: default super_admin + admin; grant to other roles under Roles & permissions. */
async function ensureAnalyticsPermission() {
	if (!sanity) return;
	await sanity.createIfNotExists({
		_id: "perm-analytics-view",
		_type: "permission",
		code: "analytics:view",
		label: "View analytics",
		category: "Admin",
		sort_order: 33,
	});
	const pid = "perm-analytics-view";
	for (const rid of ["role-super-admin", "role-admin"]) {
		const role = await sanity.fetch(`*[_id == $id][0]{ permission_ids }`, {
			id: rid,
		});
		const raw = role?.permission_ids;
		const ids = Array.isArray(raw)
			? raw.map((x) =>
					typeof x === "string" ? x : x?._ref || x?.ref || String(x),
				)
			: [];
		if (!ids.includes(pid)) {
			await sanity
				.patch(rid)
				.set({ permission_ids: [...ids, pid] })
				.commit();
		}
	}
}

/**
 * Viewing appointments: `vehicle.viewing_bookings` array in Sanity.
 * Add to the vehicle schema (array of objects) with fields:
 * customer_name, customer_phone, customer_email, scheduled_at (datetime), notes (text),
 * status (scheduled | completed | cancelled | no_show), created_at, created_by_uid, created_by_name,
 * staff_message (text, optional — shown to mentioned users / managers),
 * mentioned_firebase_uids (array of strings),
 * notify_managers (boolean, default true — ping users with manager permissions),
 * staff_alert_cleared_uids (array of strings — who dismissed the team notification).
 * Each row needs a stable _key (app generates on create).
 */
export const VIEWING_BOOKING_STATUSES = [
	"scheduled",
	"completed",
	"cancelled",
	"no_show",
];

function normalizeViewingBookingRow(b) {
	if (!b) return null;
	const key = b._key || b.id;
	if (!key) return null;
	const st = b.status || "scheduled";
	const mentions = Array.isArray(b.mentioned_firebase_uids)
		? [
				...new Set(
					b.mentioned_firebase_uids.filter(
						(x) => typeof x === "string" && x.trim(),
					),
				),
			]
		: [];
	const cleared = Array.isArray(b.staff_alert_cleared_uids)
		? [
				...new Set(
					b.staff_alert_cleared_uids.filter(
						(x) => typeof x === "string" && x.trim(),
					),
				),
			]
		: [];
	return {
		...b,
		id: key,
		_key: key,
		status: VIEWING_BOOKING_STATUSES.includes(st) ? st : "scheduled",
		mentioned_firebase_uids: mentions,
		staff_message: typeof b.staff_message === "string" ? b.staff_message : "",
		notify_managers: b.notify_managers !== false,
		staff_alert_cleared_uids: cleared,
	};
}

export function sanityVehicleToApp(doc) {
	if (!doc) return null;
	const images = (doc.images || [])
		.map((img, i) => ({
			id: img._key || `img-${i}`,
			url: img.url,
			sort_order: img.sortOrder ?? i,
		}))
		.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

	const {
		_id,
		_type,
		images: _im,
		pdi_inspection_json: _pdiJsonField,
		...rest
	} = doc;
	const viewing_bookings = (doc.viewing_bookings || [])
		.map(normalizeViewingBookingRow)
		.filter(Boolean);

	let pdi_inspection = null;
	if (
		doc.pdi_inspection_json != null &&
		String(doc.pdi_inspection_json).trim() !== ""
	) {
		pdi_inspection = deserializePdiFromStorage(doc.pdi_inspection_json);
	}
	return {
		...rest,
		id: _id,
		images,
		viewing_bookings,
		pdi_inspection,
	};
}

export async function fetchProfileWithPermissions(firebaseUid) {
	if (!sanity || !firebaseUid) return null;
	await ensureBootstrap();

	const profile = await sanity.fetch(
		`*[_type == "userProfile" && firebase_uid == $uid] | order(_createdAt asc)[0]{
      "id": _id,
      firebase_uid,
      email,
      display_name,
      "role_id": role._ref,
      "role": role->{ _id, name, description, is_system, permission_ids },
      "created_at": _createdAt
    }`,
		{ uid: firebaseUid },
	);

	if (!profile?.role) return null;

	const permIds = profile.role.permission_ids || [];
	if (permIds.length === 0) {
		return { ...profile, permissions: [] };
	}

	const perms = await sanity.fetch(
		`*[_type == "permission" && _id in $ids]{ _id, code }`,
		{ ids: permIds },
	);
	const permissionCodes = (perms || []).map((p) => p.code).filter(Boolean);

	if (!profile.role_id && profile.role?._id) {
		profile.role_id = profile.role._id;
	}

	return {
		...profile,
		permissions: permissionCodes,
	};
}

/** Stable Sanity _id per Firebase uid so parallel ensure runs cannot create duplicate rows. */
export function userProfileDocumentId(firebaseUid) {
	if (!firebaseUid) return "";
	const safe = String(firebaseUid).replace(/[^a-zA-Z0-9_.-]/g, "-");
	return `userProfile.${safe}`;
}

/** Stable Sanity _id for pending Google staff onboarding rows. */
export function staffJoinRequestDocumentId(firebaseUid) {
	if (!firebaseUid) return "";
	const safe = String(firebaseUid).replace(/[^a-zA-Z0-9_.-]/g, "-");
	return `staffJoinRequest.${safe}`;
}

function firebaseUserUsedGoogle(user) {
	return Boolean(
		user?.providerData?.some((p) => p?.providerId === "google.com"),
	);
}

async function upsertStaffJoinRequestFromFirebaseUser(user) {
	if (!sanity || !user?.uid) return;
	const rid = staffJoinRequestDocumentId(user.uid);
	const email = user.email || "";
	const display_name = user.displayName || "";
	const now = new Date().toISOString();

	const row = await sanity.fetch(
		`*[_type == "staffJoinRequest" && firebase_uid == $uid][0]{ _id, status }`,
		{ uid: user.uid },
	);

	if (!row) {
		try {
			await sanity.create({
				_id: rid,
				_type: "staffJoinRequest",
				firebase_uid: user.uid,
				email,
				display_name,
				status: "pending",
				requested_at: now,
			});
		} catch {
			await sanity
				.createIfNotExists({
					_id: rid,
					_type: "staffJoinRequest",
					firebase_uid: user.uid,
					email,
					display_name,
					status: "pending",
					requested_at: now,
				})
				.catch(() => {});
			await sanity
				.patch(rid)
				.set({
					email,
					display_name,
					status: "pending",
					requested_at: now,
					updated_at: now,
				})
				.commit()
				.catch(() => {});
		}
		return;
	}

	const patch = sanity.patch(row._id).set({
		email,
		display_name,
		updated_at: now,
	});
	if (row.status !== "ignored") {
		patch.set({ status: "pending" });
	}
	await patch.commit().catch(() => {});
}

/** Profile when approved; otherwise staffGate explains blocked Google onboarding. */
export async function fetchAuthLandingState(firebaseUid) {
	if (!sanity || !firebaseUid) {
		return { profile: null, staffGate: null };
	}
	await ensureBootstrap();
	const profile = await fetchProfileWithPermissions(firebaseUid);
	if (profile) return { profile, staffGate: null };

	const req = await fetchStaffJoinRequestForUid(firebaseUid);
	if (req?.status === "pending") return { profile: null, staffGate: "pending" };
	if (req?.status === "ignored") return { profile: null, staffGate: "ignored" };
	return { profile: null, staffGate: "none" };
}

export async function fetchStaffJoinRequestForUid(firebaseUid) {
	if (!sanity || !firebaseUid) return null;
	return sanity.fetch(
		`*[_type == "staffJoinRequest" && firebase_uid == $uid][0]{
      "id": _id,
      firebase_uid,
      email,
      display_name,
      status,
      requested_at
    }`,
		{ uid: firebaseUid },
	);
}

export async function fetchPendingStaffJoinRequests() {
	if (!sanity) return [];
	await ensureBootstrap();
	const rows = await sanity.fetch(
		`*[_type == "staffJoinRequest" && status == "pending"] | order(requested_at asc) {
      "id": _id,
      firebase_uid,
      email,
      display_name,
      status,
      requested_at
    }`,
	);
	return rows || [];
}

export async function approveStaffJoinRequest(requestSanityId, { role_id }) {
	if (!sanity) throw new Error("Sanity not configured");
	const req = await sanity.fetch(
		`*[_type == "staffJoinRequest" && _id == $id][0]{ firebase_uid, email, display_name, status }`,
		{ id: requestSanityId },
	);
	if (!req || req.status !== "pending") {
		throw new Error("Request not found or already handled");
	}
	await createUserProfileDoc({
		firebase_uid: req.firebase_uid,
		email: req.email,
		display_name: req.display_name || "",
		role_id,
	});
	await sanity.delete(requestSanityId).catch(() => {});
}

export async function dismissStaffJoinRequest(requestSanityId) {
	if (!sanity) throw new Error("Sanity not configured");
	await sanity
		.patch(requestSanityId)
		.set({
			status: "ignored",
			updated_at: new Date().toISOString(),
		})
		.commit();
}

/**
 * First registered Firebase user becomes super_admin.
 * Additional Google sign-ins without a profile queue `staffJoinRequest` for admin approval (no automatic guest profile).
 * Email/password sign-ins still get an immediate guest profile (invite-style onboarding).
 */
export async function ensureUserProfileForFirebaseUser(user) {
	if (!sanity || !user?.uid) return null;
	await ensureBootstrap();

	const rows = await sanity.fetch(
		`*[_type == "userProfile" && firebase_uid == $uid]{ _id } | order(_createdAt asc)`,
		{ uid: user.uid },
	);
	const ids = (rows || []).map((r) => r._id).filter(Boolean);

	if (ids.length > 1) {
		for (let i = 1; i < ids.length; i++) {
			await sanity.delete(ids[i]).catch(() => {});
		}
	}

	let docId = ids[0];

	if (!docId) {
		const profileId = userProfileDocumentId(user.uid);
		const totalProfiles = await sanity.fetch(
			'count(*[_type == "userProfile"])',
		);

		if (totalProfiles === 0) {
			try {
				await sanity.createIfNotExists({
					_id: profileId,
					_type: "userProfile",
					firebase_uid: user.uid,
					email: user.email || "",
					display_name: user.displayName || "",
					role: { _type: "reference", _ref: "role-super-admin" },
					created_at: new Date().toISOString(),
				});
			} catch {
				/* race/network */
			}
			docId = profileId;
		} else if (firebaseUserUsedGoogle(user)) {
			await upsertStaffJoinRequestFromFirebaseUser(user);
			return null;
		} else {
			try {
				await sanity.createIfNotExists({
					_id: profileId,
					_type: "userProfile",
					firebase_uid: user.uid,
					email: user.email || "",
					display_name: user.displayName || "",
					role: { _type: "reference", _ref: "role-guest" },
					created_at: new Date().toISOString(),
				});
			} catch {
				/* race/network */
			}
			docId = profileId;
		}
	}

	if (!docId) return null;

	const patch = sanity.patch(docId).set({
		email: user.email || "",
		updated_at: new Date().toISOString(),
	});
	const name = user.displayName?.trim();
	if (name) patch.set({ display_name: name });
	await patch.commit().catch(() => {});

	return docId;
}

// --- Vehicles ---

const vehicleProjection = `{
  ...,
  "images": images
}`;

export async function fetchVehicleById(id) {
	if (!sanity) return null;
	const doc = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0] ${vehicleProjection}`,
		{ id },
	);
	return sanityVehicleToApp(doc);
}

/**
 * Public find / preview — non-sensitive fields only (no customer, PDI, workflows).
 */
export async function fetchVehiclePublicById(id) {
	if (!sanity || !id) return null;
	const doc = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{
			_id,
			stock_id,
			brand,
			model,
			body,
			color,
			details,
			model_year,
			mileage,
			cc,
			fuel_type,
			gear,
			vin,
			plate_no,
			sold,
			reserved,
			vehicle_status,
			images[]{ _key, url, sortOrder }
		}`,
		{ id },
	);
	if (!doc) return null;
	const images = (doc.images || [])
		.map((img, i) => ({
			id: img._key || `img-${i}`,
			url: img.url,
			sort_order: img.sortOrder ?? i,
		}))
		.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
	return {
		id: doc._id,
		stock_id: doc.stock_id,
		brand: doc.brand,
		model: doc.model,
		body: doc.body,
		color: doc.color,
		details: doc.details,
		model_year: doc.model_year,
		mileage: doc.mileage,
		cc: doc.cc,
		fuel_type: doc.fuel_type,
		gear: doc.gear,
		vin: doc.vin,
		plate_no: doc.plate_no,
		sold: doc.sold === true,
		reserved: doc.reserved === true,
		vehicle_status: doc.vehicle_status,
		images,
	};
}

/**
 * Scheduled collections (pullouts): reserved, not sold.
 * Planned collection date is optional — vehicles without a date appear after dated rows (sorted last).
 * Read-only projection for public listings — excludes customer/contact, pricing, pickup tokens,
 * reservation dates, buyers, viewing bookings, etc.
 */
export async function fetchVehiclesPublicPullouts() {
	if (!sanity) return [];
	await ensureBootstrap();
	const lim = 300;
	const docs = await sanity.fetch(
		`*[_type == "vehicle" && reserved == true && sold != true]
			| order(coalesce(planned_collection_date, "9999-12-31") asc) [0...${lim}]{
			_id,
			stock_id,
			brand,
			model,
			plate_no,
			vin,
			model_year,
			vehicle_status,
			planned_collection_date,
			ready_pullout,
			reserved,
			sold,
			ops_workflow,
			ops_workflows,
			images[]{ _key, url, sortOrder }
		}`,
	);
	return (docs || []).map((d) => sanityVehicleToApp(d)).filter(Boolean);
}

export async function fetchVehicleByPickupToken(token) {
	if (!sanity) return null;
	const doc = await sanity.fetch(
		`*[_type == "vehicle" && pickup_token == $token && reserved == true && sold == false][0] ${vehicleProjection}`,
		{ token },
	);
	return sanityVehicleToApp(doc);
}

/** Removes reservation progress rows in Sanity for a vehicle (PDI steps, comments metadata). */
export async function deleteReservationWorkflowUpdatesForVehicle(vehicleId) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!vehicleId) return;
	const wids = await sanity.fetch(
		`*[_type == "reservationWorkflowUpdate" && vehicle_id == $vid]._id`,
		{ vid: vehicleId },
	);
	for (const wid of wids || []) {
		await sanity.delete(wid);
	}
}

/**
 * Customer self-service: release the reservation using the pickup link + same verification as the pickup page.
 * Clears customer fields and pickup token; deletes reservation workflow history for this vehicle.
 * Prep work paths on the vehicle are not removed (dealer can clear those in the app).
 */
export async function cancelCustomerReservationByPickupToken(
	token,
	verifiedCredential,
) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!token || !String(token).trim()) throw new Error("Invalid link");

	const vehicle = await fetchVehicleByPickupToken(token);
	if (!vehicle?.id)
		throw new Error("Reservation not found or link is no longer valid");
	if (!vehicle.reserved || vehicle.sold)
		throw new Error("This reservation cannot be cancelled here");

	const needsVerify = pickupNeedsPlateOrStockVerification(vehicle);
	const cred = String(verifiedCredential ?? "").trim();
	if (needsVerify) {
		if (!cred || !verificationMatches(cred, vehicle)) {
			throw new Error(
				"Enter the same plate number or stock ID you used to open this page.",
			);
		}
	}

	await patchVehicleFields(vehicle.id, {
		reserved: false,
		vehicle_status: "Available",
		pickup_token: null,
		reserved_date: null,
		deposit_amount: null,
		customer_name: null,
		customer_email: null,
		customer_phone: null,
		deposit_agreement_url: null,
		carplay_included: null,
		buyers_name: null,
		planned_collection_date: null,
		pickup_important_notice: null,
		pdi_inspection_json: null,
		customer_collection_confirmed_at: null,
		customer_collection_time_note: null,
	});
	await deleteReservationWorkflowUpdatesForVehicle(vehicle.id);
}

/**
 * Customer confirms they'll attend collection on the currently planned date (pickup token link).
 * Verifies plate/stock when required (same barrier as cancelling). Does not mutate planned_collection_date.
 */
export async function patchCustomerCollectionConfirmationFromPickup(
	token,
	verifiedCredential,
	{ timeNote } = {},
) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!token || !String(token).trim()) throw new Error("Invalid link");

	const vehicle = await fetchVehicleByPickupToken(token);
	if (!vehicle?.id)
		throw new Error("Reservation not found or link is no longer valid");
	if (!vehicle.reserved || vehicle.sold)
		throw new Error("This reservation cannot be updated here");

	if (!vehicle.planned_collection_date) {
		throw new Error(
			"No collection date is set yet. Please speak to your sales contact.",
		);
	}

	const needsVerify = pickupNeedsPlateOrStockVerification(vehicle);
	const cred = String(verifiedCredential ?? "").trim();
	if (needsVerify) {
		if (!cred || !verificationMatches(cred, vehicle)) {
			throw new Error(
				"Enter the same plate number or stock ID used to unlock this page.",
			);
		}
	}

	const safeNote =
		timeNote !== undefined ? sanitizeCustomerCollectionNote(timeNote) : "";

	await patchVehicleFields(vehicle.id, {
		customer_collection_confirmed_at: new Date().toISOString(),
		customer_collection_time_note: safeNote !== "" ? safeNote : null,
	});
}

export async function fetchVehicleLocations(query) {
	if (!sanity) return [];
	const all = await sanity.fetch(
		`array::unique(*[_type == "vehicle" && defined(location)].location)`,
	);
	const list = (all || []).filter(Boolean).sort();
	const q = (query || "").trim().toLowerCase();
	if (q.length < 2) return list.slice(0, 15);
	return list
		.filter((loc) => String(loc).toLowerCase().includes(q))
		.slice(0, 15);
}

function buildVehicleImagesArray(existingImages, imagesToKeepKeys, newUrls) {
	const kept = (existingImages || []).filter((img) => {
		const key = img._key || img.id;
		return imagesToKeepKeys.has(key);
	});
	const sortedKept = [...kept].sort(
		(a, b) =>
			(a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0),
	);
	const out = sortedKept.map((img, i) => ({
		_key: img._key || img.id,
		_type: "vehicleImage",
		url: img.url,
		sortOrder: i,
	}));
	let idx = out.length;
	for (const url of newUrls) {
		out.push({
			_key: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
			_type: "vehicleImage",
			url,
			sortOrder: idx++,
		});
	}
	return out;
}

/** Strip undefined; omit images (handled separately) */
function cleanVehiclePayload(payload) {
	const out = {};
	for (const [k, v] of Object.entries(payload)) {
		if (k === "images" || k === "id" || k === "_id") continue;
		if (v !== undefined) out[k] = v;
	}
	return out;
}

export async function saveVehicle({
	vehicleId,
	payload,
	existingDoc,
	newImageUrls,
	removedImageKeys,
}) {
	if (!sanity) throw new Error("Sanity not configured");

	const removed =
		removedImageKeys instanceof Set
			? removedImageKeys
			: new Set(removedImageKeys || []);
	const keepKeys = new Set();
	for (const img of existingDoc?.images || []) {
		const key = img._key || img.id;
		if (!removed.has(key)) keepKeys.add(key);
	}
	const images = buildVehicleImagesArray(
		existingDoc?.images || [],
		keepKeys,
		newImageUrls || [],
	);

	const cleaned = cleanVehiclePayload(payload);

	if (vehicleId) {
		await sanity
			.patch(vehicleId)
			.set({ ...cleaned, images, updated_at: new Date().toISOString() })
			.commit();
		return vehicleId;
	}

	const created = await sanity.create({
		_type: "vehicle",
		...cleaned,
		images,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	});
	return created._id;
}

export async function patchVehicleFields(id, fields) {
	if (!sanity) throw new Error("Sanity not configured");
	await sanity
		.patch(id)
		.set({ ...fields, updated_at: new Date().toISOString() })
		.commit();
}

/** Persist PDI checklist JSON on vehicle (`pdi_inspection_json` Sanity field — see README). */
export async function saveVehiclePdiInspectionJson(vehicleId, inspectionState) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!vehicleId) throw new Error("Vehicle id required");
	const json = serializePdiForStorage(inspectionState);
	await patchVehicleFields(vehicleId, { pdi_inspection_json: json });
}

function newViewingBookingKey() {
	return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function sanitizeViewingBookingPayload(input, { partial } = {}) {
	if (
		input.status != null &&
		input.status !== "" &&
		!VIEWING_BOOKING_STATUSES.includes(input.status)
	) {
		throw new Error("Invalid status");
	}

	if (partial) {
		const out = {};
		if (input.customer_name !== undefined)
			out.customer_name = (input.customer_name || "").trim();
		if (input.customer_phone !== undefined)
			out.customer_phone = (input.customer_phone || "").trim();
		if (input.customer_email !== undefined)
			out.customer_email = (input.customer_email || "").trim();
		if (input.notes !== undefined) out.notes = (input.notes || "").trim();
		if (input.staff_message !== undefined)
			out.staff_message = (input.staff_message || "").trim();
		if (input.scheduled_at !== undefined) {
			const s = input.scheduled_at;
			if (s && Number.isNaN(new Date(s).getTime()))
				throw new Error("Invalid date and time");
			out.scheduled_at = s;
		}
		if (input.status !== undefined) out.status = input.status || "scheduled";
		if (input.notify_managers !== undefined)
			out.notify_managers = input.notify_managers !== false;
		if (input.mentioned_firebase_uids !== undefined) {
			out.mentioned_firebase_uids = Array.isArray(input.mentioned_firebase_uids)
				? [
						...new Set(
							input.mentioned_firebase_uids.filter(
								(x) => typeof x === "string" && x.trim(),
							),
						),
					]
				: [];
		}
		return out;
	}

	const name = (input.customer_name || "").trim();
	if (!name) throw new Error("Customer name is required");
	const scheduled = input.scheduled_at;
	if (!scheduled) throw new Error("Date and time are required");
	if (Number.isNaN(new Date(scheduled).getTime()))
		throw new Error("Invalid date and time");
	const status = input.status || "scheduled";
	const rawMentions = input.mentioned_firebase_uids;
	const mentioned_firebase_uids = Array.isArray(rawMentions)
		? [...new Set(rawMentions.filter((x) => typeof x === "string" && x.trim()))]
		: [];
	return {
		customer_name: name,
		customer_phone: (input.customer_phone || "").trim(),
		customer_email: (input.customer_email || "").trim(),
		scheduled_at: scheduled,
		notes: (input.notes || "").trim(),
		status,
		staff_message: (input.staff_message || "").trim(),
		mentioned_firebase_uids,
		notify_managers: input.notify_managers !== false,
	};
}

/**
 * Add a viewing appointment (multiple per vehicle). Requires matching `viewing_bookings` field in Sanity schema.
 * @param {string} vehicleId
 * @param {object} input
 * @param {{ uid?: string, displayName?: string }} meta
 */
export async function addVehicleViewingBooking(vehicleId, input, meta = {}) {
	if (!sanity) throw new Error("Sanity not configured");
	const payload = sanitizeViewingBookingPayload(input);
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ viewing_bookings }`,
		{ id: vehicleId },
	);
	if (!v) throw new Error("Vehicle not found");
	const existing = Array.isArray(v.viewing_bookings) ? v.viewing_bookings : [];
	const _key = newViewingBookingKey();
	const row = {
		_key,
		...payload,
		staff_alert_cleared_uids: [],
		created_at: new Date().toISOString(),
		created_by_uid: meta.uid || "",
		created_by_name: meta.displayName || "",
	};
	await sanity
		.patch(vehicleId)
		.set({
			viewing_bookings: [...existing, row],
			updated_at: new Date().toISOString(),
		})
		.commit();
	return normalizeViewingBookingRow(row);
}

/** Stops team-ping notifications (manager / @mention) for this booking for the current user. */
export async function dismissViewingStaffAlert(
	vehicleId,
	bookingKey,
	firebaseUid,
) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!bookingKey || !firebaseUid) throw new Error("Cannot dismiss");
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ viewing_bookings }`,
		{ id: vehicleId },
	);
	if (!v) throw new Error("Vehicle not found");
	const list = Array.isArray(v.viewing_bookings) ? [...v.viewing_bookings] : [];
	const i = list.findIndex((b) => b._key === bookingKey);
	if (i === -1) throw new Error("Booking not found");
	const prev = Array.isArray(list[i].staff_alert_cleared_uids)
		? [...list[i].staff_alert_cleared_uids]
		: [];
	if (!prev.includes(firebaseUid)) prev.push(firebaseUid);
	list[i] = { ...list[i], staff_alert_cleared_uids: prev };
	await sanity
		.patch(vehicleId)
		.set({ viewing_bookings: list, updated_at: new Date().toISOString() })
		.commit();
}

/** Vehicles with any viewing rows — for manager/mention notifications (light query). */
export async function fetchVehiclesForViewingStaffAlerts() {
	if (!sanity) return [];
	return sanity.fetch(
		`*[_type == "vehicle" && defined(viewing_bookings) && count(viewing_bookings) > 0]{
      _id,
      stock_id,
      brand,
      model,
      viewing_bookings
    }`,
	);
}

/** All vehicles that have viewings — hub page (no images). */
export async function fetchVehiclesForViewingsPage() {
	if (!sanity) return [];
	const docs = await sanity.fetch(
		`*[_type == "vehicle" && defined(viewing_bookings) && count(viewing_bookings) > 0] | order(stock_id asc) {
      _id,
      stock_id,
      brand,
      model,
      sold,
      reserved,
      viewing_bookings
    }`,
	);
	return (docs || []).map((doc) => ({
		id: doc._id,
		stock_id: doc.stock_id,
		brand: doc.brand,
		model: doc.model,
		sold: doc.sold,
		reserved: doc.reserved,
		viewing_bookings: (doc.viewing_bookings || [])
			.map(normalizeViewingBookingRow)
			.filter(Boolean),
	}));
}

/** Eligible fleet rows for scheduling a viewing (hub modal vehicle picker). */
export async function fetchVehiclesForViewingBookingPicker() {
	if (!sanity) return [];
	const docs = await sanity.fetch(
		`*[_type == "vehicle"] | order(coalesce(stock_id, '') asc) {
      _id,
      stock_id,
      plate_no,
      brand,
      model,
      sold,
      reserved,
      "viewing_count": count(viewing_bookings)
    }`,
	);
	return (docs || []).map((doc) => ({
		id: doc._id,
		stock_id: doc.stock_id ?? "",
		plate_no: doc.plate_no ?? "",
		brand: doc.brand ?? "",
		model: doc.model ?? "",
		sold: !!doc.sold,
		reserved: !!doc.reserved,
		viewing_count: typeof doc.viewing_count === "number" ? doc.viewing_count : 0,
	}));
}

/** Vehicles relevant to CRM / re-marketing: reservation & sale contacts + viewing bookings. */
export async function fetchVehiclesForCustomersDirectory() {
	if (!sanity) return [];
	const docs = await sanity.fetch(
		`*[_type == "vehicle" && (
      (defined(customer_name) && customer_name != "") ||
      (defined(customer_email) && customer_email != "") ||
      (defined(customer_phone) && customer_phone != "") ||
      (defined(buyers_name) && buyers_name != "") ||
      (defined(viewing_bookings) && count(viewing_bookings) > 0)
    )] | order(stock_id asc) {
      _id,
      stock_id,
      plate_no,
      brand,
      model,
      vehicle_status,
      reserved,
      sold,
      customer_name,
      customer_email,
      customer_phone,
      buyers_name,
      deposit_amount,
      reserved_date,
      planned_collection_date,
      selling_price,
      viewing_bookings
    }`,
	);
	return (docs || []).map((doc) => ({
		id: doc._id,
		stock_id: doc.stock_id ?? "",
		plate_no: doc.plate_no ?? "",
		brand: doc.brand,
		model: doc.model,
		vehicle_status: doc.vehicle_status ?? "",
		reserved: !!doc.reserved,
		sold: !!doc.sold,
		customer_name: doc.customer_name,
		customer_email: doc.customer_email,
		customer_phone: doc.customer_phone,
		buyers_name: doc.buyers_name,
		deposit_amount: doc.deposit_amount,
		reserved_date: doc.reserved_date,
		planned_collection_date: doc.planned_collection_date,
		selling_price: doc.selling_price,
		viewing_bookings: (doc.viewing_bookings || [])
			.map(normalizeViewingBookingRow)
			.filter(Boolean),
	}));
}

/**
 * @param {string} vehicleId
 * @param {string} bookingKey — Sanity `_key` of the booking row
 * @param {object} updates — partial fields
 */
export async function updateVehicleViewingBooking(
	vehicleId,
	bookingKey,
	updates,
) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!bookingKey) throw new Error("Booking not found");
	const patchFields = sanitizeViewingBookingPayload(updates, { partial: true });
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ viewing_bookings }`,
		{ id: vehicleId },
	);
	if (!v) throw new Error("Vehicle not found");
	const list = Array.isArray(v.viewing_bookings) ? [...v.viewing_bookings] : [];
	const i = list.findIndex((b) => b._key === bookingKey);
	if (i === -1) throw new Error("Booking not found");
	list[i] = { ...list[i], ...patchFields };
	await sanity
		.patch(vehicleId)
		.set({ viewing_bookings: list, updated_at: new Date().toISOString() })
		.commit();
	return normalizeViewingBookingRow(list[i]);
}

export async function removeVehicleViewingBooking(vehicleId, bookingKey) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!bookingKey) throw new Error("Booking not found");
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ viewing_bookings }`,
		{ id: vehicleId },
	);
	if (!v) throw new Error("Vehicle not found");
	const list = (
		Array.isArray(v.viewing_bookings) ? v.viewing_bookings : []
	).filter((b) => b._key !== bookingKey);
	await sanity
		.patch(vehicleId)
		.set({ viewing_bookings: list, updated_at: new Date().toISOString() })
		.commit();
}

export async function deleteVehicle(id) {
	if (!sanity) throw new Error("Sanity not configured");
	await deleteReservationWorkflowUpdatesForVehicle(id);
	await sanity.delete(id);
}

/** @param {object} opts
 *  status: 'available' | 'sold' | 'reserved' | 'newly_arrived' | undefined
 *  search, brand, model, maxPrice, sold, reserved (legacy), limit
 *  pendingPlateOnly — when true: no plate yet (unset, empty, or whitespace-only)
 *  stock_id, vin, plate_no — AND filters (substring match; VIN/plate normalized)
 *  publicCatalog — when true: unsold vehicles only (for public find page)
 */
export function buildVehicleFilter(opts = {}) {
	const clauses = ['_type == "vehicle"'];
	const params = {};

	if (opts.pendingPlateOnly === true) {
		clauses.push(
			'(!defined(plate_no) || plate_no == "" || plate_no match "^\\\\s*$")',
		);
	}

	const status = opts.status;
	if (status === "available") {
		clauses.push("sold == false");
		clauses.push("reserved == false");
		clauses.push(
			'(!defined(vehicle_status) || vehicle_status != "Newly arrived")',
		);
	} else if (status === "newly_arrived") {
		clauses.push("sold == false");
		clauses.push("reserved == false");
		clauses.push('vehicle_status == "Newly arrived"');
	} else if (status === "sold") {
		clauses.push("sold == true");
	} else if (status === "reserved") {
		clauses.push("reserved == true");
		clauses.push("sold == false");
	} else {
		if (opts.sold !== undefined) {
			clauses.push("sold == $sold");
			params.sold = opts.sold;
		}
		if (opts.reserved !== undefined) {
			clauses.push("reserved == $reserved");
			params.reserved = opts.reserved;
		}
	}

	const mp =
		opts.maxPrice != null && opts.maxPrice !== ""
			? Number(opts.maxPrice)
			: null;
	if (mp != null && !isNaN(mp) && mp > 0) {
		clauses.push("(!defined(selling_price) || selling_price <= $maxPrice)");
		params.maxPrice = mp;
	}

	if (opts.brand) {
		clauses.push("brand == $brand");
		params.brand = opts.brand;
	}
	if (opts.model) {
		clauses.push("model == $model");
		params.model = opts.model;
	}
	if (opts.search?.trim()) {
		clauses.push(
			"(stock_id match $spat || plate_no match $spat || brand match $spat || model match $spat || (defined(location) && location match $spat) || (defined(vin) && vin match $spat))",
		);
		params.spat = `*${opts.search.trim()}*`;
	}
	if (opts.stock_id?.trim()) {
		clauses.push("stock_id match $patStock");
		params.patStock = `*${opts.stock_id.trim()}*`;
	}
	if (opts.vin?.trim()) {
		const vt = opts.vin.trim().toUpperCase().replace(/\s+/g, "");
		if (vt) {
			clauses.push("defined(vin) && upper(vin) match $patVin");
			params.patVin = `*${vt}*`;
		}
	}
	if (opts.plate_no?.trim()) {
		const pt = opts.plate_no.trim().toUpperCase().replace(/\s+/g, "");
		if (pt) {
			clauses.push(
				"defined(plate_no) && upper(plate_no) match $patPlate",
			);
			params.patPlate = `*${pt}*`;
		}
	}
	if (opts.publicCatalog === true) {
		clauses.push("sold != true");
	}

	return { filter: clauses.join(" && "), params };
}

export async function fetchVehiclesForList(opts = {}) {
	if (!sanity) return [];
	const lim = Math.min(Number(opts.limit) || 500, 2000);
	const { filter, params } = buildVehicleFilter(opts);
	const q = `*[${filter}] | order(_createdAt desc) [0...${lim}] ${vehicleProjection}`;
	const docs = await sanity.fetch(q, params);
	return (docs || []).map(sanityVehicleToApp);
}

export async function fetchVehiclesPage(filters, offset, pageSize) {
	if (!sanity) return { items: [], total: 0 };
	const { filter, params } = buildVehicleFilter(filters);
	const total = await sanity.fetch(`count(*[${filter}])`, params);
	const end = offset + pageSize;
	const docs = await sanity.fetch(
		`*[${filter}] | order(_createdAt desc) [${offset}...${end}] ${vehicleProjection}`,
		params,
	);
	return { items: (docs || []).map(sanityVehicleToApp), total };
}

export async function fetchVehiclesForModelCounts(filters) {
	if (!sanity) return {};
	const { filter, params } = buildVehicleFilter(filters);
	const rows = await sanity.fetch(
		`*[${filter}]{ brand, model }[0...1999]`,
		params,
	);
	const counts = {};
	for (const v of rows || []) {
		const key = `${(v.brand || "").trim()}|${(v.model || "").trim()}`;
		counts[key] = (counts[key] || 0) + 1;
	}
	return counts;
}

export async function fetchAllVehiclesFiltered(filters) {
	if (!sanity) return [];
	const { filter, params } = buildVehicleFilter(filters);
	const docs = await sanity.fetch(
		`*[${filter}] | order(_createdAt desc) [0...4999] ${vehicleProjection}`,
		params,
	);
	return (docs || []).map(sanityVehicleToApp);
}

export async function fetchVehiclesByPlateOrStock(q) {
	if (!sanity) return [];
	const qt = (q || "").trim();
	if (!qt) return [];
	const pat = `*${qt}*`;
	const docs = await sanity.fetch(
		`*[ _type == "vehicle" && (plate_no match $p || stock_id match $p || vin match $p)][0...5] ${vehicleProjection}`,
		{ p: pat },
	);
	return (docs || []).map(sanityVehicleToApp);
}

export async function fetchSimilarVehiclesPool(excludeId) {
	if (!sanity) return [];
	const docs = await sanity.fetch(
		`*[_type == "vehicle" && sold == false && reserved == false && _id != $ex][0...100] ${vehicleProjection}`,
		{ ex: excludeId },
	);
	return (docs || []).map(sanityVehicleToApp);
}

export async function vehicleCounts() {
	if (!sanity) return { available: 0, newly_arrived: 0, reserved: 0, sold: 0 };
	const [available, newly_arrived, reserved, sold] = await Promise.all([
		sanity.fetch(
			'count(*[_type == "vehicle" && sold == false && reserved == false && (!defined(vehicle_status) || vehicle_status != "Newly arrived")])',
		),
		sanity.fetch(
			'count(*[_type == "vehicle" && sold == false && reserved == false && vehicle_status == "Newly arrived"])',
		),
		sanity.fetch(
			'count(*[_type == "vehicle" && reserved == true && sold == false])',
		),
		sanity.fetch('count(*[_type == "vehicle" && sold == true])'),
	]);
	return { available, newly_arrived, reserved, sold };
}

export async function fetchRecentSold(limit = 10) {
	if (!sanity) return [];
	const lim = Math.min(Math.max(1, Number(limit) || 10), 50);
	const docs = await sanity.fetch(
		`*[_type == "vehicle" && sold == true] | order(_createdAt desc) [0...${lim}] ${vehicleProjection}`,
	);
	return (docs || []).map(sanityVehicleToApp);
}

export async function fetchBrandsAndModels() {
	if (!sanity) return { brands: [], modelsByBrand: {} };
	const rows = await sanity.fetch(
		`*[_type == "vehicle" && defined(brand)]{ brand, model }`,
	);
	const brands = [
		...new Set((rows || []).map((r) => r.brand).filter(Boolean)),
	].sort();
	const modelsByBrand = {};
	for (const r of rows || []) {
		if (!r.brand || !r.model) continue;
		if (!modelsByBrand[r.brand]) modelsByBrand[r.brand] = new Set();
		modelsByBrand[r.brand].add(r.model);
	}
	for (const b of Object.keys(modelsByBrand)) {
		modelsByBrand[b] = [...modelsByBrand[b]].sort();
	}
	return { brands, modelsByBrand };
}

// --- Workflow ---

export async function fetchWorkflowUpdates(vehicleId) {
	if (!sanity) return [];
	return sanity.fetch(
		`*[_type == "reservationWorkflowUpdate" && vehicle_id == $vid] | order(updated_at desc) {
      ...,
      "id": _id
    }`,
		{ vid: vehicleId },
	);
}

export async function insertWorkflowUpdate(row) {
	if (!sanity) throw new Error("Sanity not configured");
	await sanity.create({
		_type: "reservationWorkflowUpdate",
		...row,
		updated_at: new Date().toISOString(),
	});
}

export async function deleteWorkflowUpdate(id) {
	if (!sanity) throw new Error("Sanity not configured");
	await sanity.delete(id);
}

// --- Work paths (multi-step prep pipelines on vehicles) ---

function newWorkPathStepKey() {
	return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Client + server: stable keys for checklist rows on work path steps */
export function newWorkflowSubtaskKey() {
	return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function randomWorkflowInstanceId() {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeWorkPathApplyWhen(raw) {
	if (raw === "reserved_only" || raw === "available_listed_only") return raw;
	return "always";
}

/**
 * Stable template id — default prep workflow seeded once a user profile exists.
 * Vehicle PDI checklist is separate (`pdi_inspection_json`).
 */
const STANDARD_PREP_WORKPATH_DOC_ID = "workpath-standard-prep";

/** Create default template if missing (Work paths page + vehicle apply picker). Requires Editor token + ≥1 sign-in profile. */
export async function ensurePredefinedWorkPaths() {
	if (!sanity) return;
	try {
		const n = await sanity.fetch(
			`count(*[_type == "workPath" && _id == $id])`,
			{ id: STANDARD_PREP_WORKPATH_DOC_ID },
		);
		if ((n ?? 0) > 0) return;

		const profile = await sanity.fetch(
			`*[_type == "userProfile" && defined(role)] | order(_createdAt asc)[0]{ _id }`,
		);
		if (!profile?._id) return;

		const pid = profile._id;
		const now = new Date().toISOString();

		await sanity.createIfNotExists({
			_id: STANDARD_PREP_WORKPATH_DOC_ID,
			_type: "workPath",
			name: "Standard pre-delivery prep",
			description:
				"Starter prep workflow before customer handover. Edit steps for your site — valeting, QC, paperwork. Applies only once a vehicle is reserved (change under Work paths if needed).",
			apply_when: "reserved_only",
			allow_step_overlap: false,
			steps: [
				{
					_key: "stp-valet",
					title: "Wash, valet & presentation",
					role: { _type: "reference", _ref: "role-worker" },
					assignee: { _type: "reference", _ref: pid },
					subtasks: [],
				},
				{
					_key: "stp-tech",
					title: "Technical checks & QC",
					role: { _type: "reference", _ref: "role-mechanic" },
					assignee: { _type: "reference", _ref: pid },
					subtasks: [],
				},
				{
					_key: "stp-docs",
					title: "Handover paperwork & accessories",
					role: { _type: "reference", _ref: "role-manager" },
					assignee: { _type: "reference", _ref: pid },
					subtasks: [],
				},
			],
			created_at: now,
			updated_at: now,
		});
	} catch (e) {
		console.warn(
			"[vehicle-identifier] Seed work path skipped:",
			e?.message || e,
		);
	}
}

/** Full template (admin + apply). Avoids invalid `...` spread in GROQ. */
const workPathFullProjection = `{
  _id,
  "id": _id,
  name,
  description,
  apply_when,
  allow_step_overlap,
  steps[]{
    _key,
    title,
    "role_id": role._ref,
    "role": role->{ _id, name },
    "assignee_id": assignee._ref,
    "assignee": assignee->{
      _id,
      firebase_uid,
      display_name,
      email,
      "assignee_role_id": role._ref,
      "assignee_role": role->{ name }
    }
  }
}`;

function buildWorkPathStepDocumentPayload(s) {
	return {
		_key: s._key || newWorkPathStepKey(),
		title: s.title.trim(),
		role: { _type: "reference", _ref: s.role_id },
		assignee: { _type: "reference", _ref: s.assignee_profile_id },
		subtasks: [],
	};
}

/** Subtasks are defined when applying a path to a vehicle, not on the template. */
function normalizeAssignmentSubtasksForInstance(rawList) {
	const out = [];
	for (const st of rawList || []) {
		const kind = st.kind === "image" ? "image" : "text";
		const _key = (st._key && String(st._key).trim()) || newWorkflowSubtaskKey();
		if (kind === "text") {
			const body = (st.body || "").trim();
			if (!body) continue;
			out.push({ _key, kind: "text", body, done: false });
		} else {
			const url = (st.image_url || "").trim();
			if (!url) continue;
			const caption = (st.body || "").trim();
			out.push({
				_key,
				kind: "image",
				body: caption,
				image_url: url,
				done: false,
			});
		}
	}
	return out;
}

/** Dropdown list only — always works even if step projections fail elsewhere. */
export async function fetchWorkPathTemplatesList() {
	if (!sanity) return [];
	await ensureBootstrap();
	await ensurePredefinedWorkPaths();
	return sanity.fetch(
		`*[_type == "workPath"] | order(name asc) { _id, "id": _id, name, description, apply_when, allow_step_overlap }`,
	);
}

export async function fetchAllWorkPaths() {
	if (!sanity) return [];
	await ensureBootstrap();
	await ensurePredefinedWorkPaths();
	return sanity.fetch(
		`*[_type == "workPath"] | order(name asc) ${workPathFullProjection}`,
	);
}

export async function fetchWorkPathById(id) {
	if (!sanity) return null;
	await ensureBootstrap();
	return sanity.fetch(
		`*[_type == "workPath" && _id == $id][0] ${workPathFullProjection}`,
		{ id },
	);
}

/** @param {{ name: string, description?: string, steps: { title: string, role_id: string, assignee_profile_id: string }[] }} body */
export async function createWorkPath(body) {
	if (!sanity) throw new Error("Sanity not configured");
	const {
		name,
		description = "",
		steps = [],
		apply_when,
		allow_step_overlap,
	} = body;
	if (!name?.trim()) throw new Error("Work path name is required");
	if (!steps.length) throw new Error("Add at least one step");
	const docSteps = [];
	for (const s of steps) {
		if (!s.title?.trim()) throw new Error("Each step needs a title");
		if (!s.role_id) throw new Error("Each step needs a role");
		if (!s.assignee_profile_id) throw new Error("Each step needs an assignee");
		docSteps.push(buildWorkPathStepDocumentPayload(s));
	}
	const created = await sanity.create({
		_type: "workPath",
		name: name.trim(),
		description: (description || "").trim(),
		apply_when: normalizeWorkPathApplyWhen(apply_when),
		allow_step_overlap: !!allow_step_overlap,
		steps: docSteps,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	});
	return created._id;
}

export async function updateWorkPath(id, body) {
	if (!sanity) throw new Error("Sanity not configured");
	const {
		name,
		description = "",
		steps = [],
		apply_when,
		allow_step_overlap,
	} = body;
	if (!name?.trim()) throw new Error("Work path name is required");
	if (!steps.length) throw new Error("Add at least one step");
	const docSteps = [];
	for (const s of steps) {
		if (!s.title?.trim()) throw new Error("Each step needs a title");
		if (!s.role_id) throw new Error("Each step needs a role");
		if (!s.assignee_profile_id) throw new Error("Each step needs an assignee");
		docSteps.push(buildWorkPathStepDocumentPayload(s));
	}
	await sanity
		.patch(id)
		.set({
			name: name.trim(),
			description: (description || "").trim(),
			apply_when: normalizeWorkPathApplyWhen(apply_when),
			allow_step_overlap: !!allow_step_overlap,
			steps: docSteps,
			updated_at: new Date().toISOString(),
		})
		.commit();
}

export async function deleteWorkPath(id) {
	if (!sanity) throw new Error("Sanity not configured");
	await sanity.delete(id);
}

function stableLegacyInstanceId(w) {
	if (w.instance_id) return w.instance_id;
	const raw = `${w.template_id || ""}|${w.started_at || ""}|${w.template_name || ""}|${(w.steps || []).length}`;
	let h = 0;
	for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
	return `legacy-${Math.abs(h).toString(36)}`;
}

function migrateLegacyWorkflowInstance(w) {
	if (!w) return null;
	const base = {
		...w,
		instance_id: stableLegacyInstanceId(w),
		priority: w.priority === "urgent" ? "urgent" : "normal",
		sort_order: Number(w.sort_order) || 0,
		deadline_at: w.deadline_at || null,
		discussion: Array.isArray(w.discussion) ? w.discussion : [],
		current_step_started_at: w.current_step_started_at || w.started_at || null,
		completed_steps: Array.isArray(w.completed_steps) ? w.completed_steps : [],
		time_sessions: Array.isArray(w.time_sessions) ? w.time_sessions : [],
		apply_when: w.apply_when || "always",
		allow_step_overlap: w.allow_step_overlap === true,
	};
	return base;
}

function closeOpenTimeSessionsForUser(inst, userUid, endedAtIso) {
	if (!userUid) return inst.time_sessions || [];
	return (inst.time_sessions || []).map((s) =>
		s.user_uid === userUid && !s.ended_at ? { ...s, ended_at: endedAtIso } : s,
	);
}

/** @param {Record<string, unknown>|null|undefined} vehicle */
export function normalizeVehicleWorkflowInstances(vehicle) {
	if (!vehicle) return [];
	if (Array.isArray(vehicle.ops_workflows) && vehicle.ops_workflows.length) {
		return vehicle.ops_workflows
			.map(migrateLegacyWorkflowInstance)
			.filter(Boolean);
	}
	if (vehicle.ops_workflow) {
		const one = migrateLegacyWorkflowInstance(vehicle.ops_workflow);
		return one ? [one] : [];
	}
	return [];
}

export function workflowInstanceStepKey(steps, index) {
	const s = steps[index];
	return s?._key || `step-${index}`;
}

function completedStepKeysSet(inst) {
	const m = new Set();
	for (const c of inst.completed_steps || []) {
		if (c.step_key) m.add(c.step_key);
	}
	return m;
}

export function collectMyWorkItems(vehicles, firebaseUid) {
	const out = [];
	for (const vehicle of vehicles || []) {
		const instances = normalizeVehicleWorkflowInstances(vehicle);
		for (const inst of instances) {
			if (inst.status !== "active") continue;
			const steps = inst.steps || [];
			const parallel = inst.allow_step_overlap === true;
			if (parallel) {
				const done = completedStepKeysSet(inst);
				steps.forEach((step, stepIndex) => {
					const sk = workflowInstanceStepKey(steps, stepIndex);
					if (done.has(sk)) return;
					if (step.assignee_uid === firebaseUid) {
						out.push({ vehicle, instance: inst, currentStep: step, stepIndex });
					}
				});
			} else {
				const idx = Number(inst.current_step_index) || 0;
				const cur = steps[idx];
				if (cur?.assignee_uid === firebaseUid) {
					out.push({
						vehicle,
						instance: inst,
						currentStep: cur,
						stepIndex: idx,
					});
				}
			}
		}
	}
	out.sort((a, b) => {
		const pri = (x) => (x.instance.priority === "urgent" ? 0 : 1);
		let c = pri(a) - pri(b);
		if (c !== 0) return c;
		const da = a.instance.deadline_at
			? new Date(a.instance.deadline_at).getTime()
			: Infinity;
		const db = b.instance.deadline_at
			? new Date(b.instance.deadline_at).getTime()
			: Infinity;
		c = da - db;
		if (c !== 0) return c;
		return (
			(Number(a.instance.sort_order) || 0) -
			(Number(b.instance.sort_order) || 0)
		);
	});
	return out;
}

export function getWorkflowDeadlineVisual(instance) {
	if (!instance) return { tone: "none", label: null };
	if (instance.priority === "urgent")
		return { tone: "urgent", label: "Urgent" };
	if (!instance.deadline_at) return { tone: "none", label: null };
	const d = new Date(instance.deadline_at).getTime();
	const now = Date.now();
	if (d < now) return { tone: "overdue", label: "Overdue" };
	if (d - now < 24 * 60 * 60 * 1000)
		return { tone: "due_soon", label: "Due soon" };
	return { tone: "deadline", label: "Has deadline" };
}

function buildStepsSnapshotFromTemplate(template, stepSubtasksByKey = {}) {
	const stepsSnapshot = [];
	const extras =
		stepSubtasksByKey &&
		typeof stepSubtasksByKey === "object" &&
		!Array.isArray(stepSubtasksByKey)
			? stepSubtasksByKey
			: {};
	for (const s of template.steps || []) {
		const assignee = s.assignee;
		if (!assignee?.firebase_uid)
			throw new Error(`Step "${s.title}" has no valid assignee`);
		const roleId = s.role_id || s.role?._id;
		const assigneeRole = assignee.assignee_role_id;
		const assigneeRoleName = assignee.assignee_role?.name;
		const superOk = assigneeRoleName === "super_admin";
		if (roleId && assigneeRole && assigneeRole !== roleId && !superOk) {
			throw new Error(
				`Assignee for "${s.title}" does not have the selected role`,
			);
		}
		const stepKey = s._key || newWorkPathStepKey();
		const rawSubs = extras[stepKey] != null ? extras[stepKey] : extras[s._key];
		const subtasks = normalizeAssignmentSubtasksForInstance(
			Array.isArray(rawSubs) ? rawSubs : [],
		);
		stepsSnapshot.push({
			_key: stepKey,
			title: s.title,
			role_id: roleId,
			role_name: s.role?.name || "",
			assignee_uid: assignee.firebase_uid,
			assignee_name:
				assignee.display_name || assignee.email || assignee.firebase_uid,
			assignee_profile_id: assignee._id || s.assignee_id,
			...(subtasks.length ? { subtasks } : {}),
		});
	}
	return stepsSnapshot;
}

export function workflowStepIncompleteSubtasksCount(step) {
	const subs = step?.subtasks || [];
	if (!subs.length) return 0;
	return subs.filter((t) => !t.done).length;
}

function stepChecklistPending(step) {
	const n = workflowStepIncompleteSubtasksCount(step);
	return n > 0 ? n : null;
}

/**
 * @param {string} vehicleId
 * @param {string} templateId
 * @param {{
 *   deadlineAt?: string|null,
 *   priority?: 'normal'|'urgent',
 *   step_subtasks_by_key?: Record<string, Array<{ _key?: string, kind: 'text'|'image', body?: string, image_url?: string }>>,
 * }} [options]
 */
export async function applyWorkPathToVehicle(
	vehicleId,
	templateId,
	options = {},
) {
	if (!sanity) throw new Error("Sanity not configured");
	const template = await fetchWorkPathById(templateId);
	if (!template?.steps?.length)
		throw new Error("Work path not found or has no steps");

	const stepsSnapshot = buildStepsSnapshotFromTemplate(
		template,
		options.step_subtasks_by_key,
	);
	const now = new Date().toISOString();
	const deadlineAt =
		options.deadlineAt && String(options.deadlineAt).trim()
			? String(options.deadlineAt).trim()
			: null;
	const priority = options.priority === "urgent" ? "urgent" : "normal";

	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows, sold, reserved, planned_collection_date }`,
		{
			id: vehicleId,
		},
	);

	const dlOk = validateWorkPathDeadlineVsPlannedCollection(
		deadlineAt,
		v?.planned_collection_date,
	);
	if (!dlOk.ok) throw new Error(dlOk.message);

	const pastOk = validateWorkPathDeadlineNotInPast(deadlineAt);
	if (!pastOk.ok) throw new Error(pastOk.message);

	const gate = normalizeWorkPathApplyWhen(template.apply_when);
	const allow = vehicleMeetsApplyWhen(
		{ sold: v?.sold, reserved: v?.reserved },
		gate,
	);
	if (!allow.ok) throw new Error(allow.message);

	let list = [];
	if (v?.ops_workflows?.length) {
		list = v.ops_workflows.map(migrateLegacyWorkflowInstance).filter(Boolean);
	} else if (v?.ops_workflow) {
		const one = migrateLegacyWorkflowInstance(v.ops_workflow);
		if (one) list = [one];
	}

	if (list.length > 0) {
		throw new Error(
			"This vehicle already has a work path. Remove it before assigning another.",
		);
	}

	const maxSort = list.reduce(
		(m, x) => Math.max(m, Number(x.sort_order) || 0),
		0,
	);
	const newInst = {
		instance_id: randomWorkflowInstanceId(),
		template_id: templateId,
		template_name: template.name || "Work path",
		current_step_index: 0,
		status: "active",
		started_at: now,
		current_step_started_at: now,
		steps: stepsSnapshot,
		completed_steps: [],
		priority,
		sort_order: maxSort + 1,
		deadline_at: deadlineAt,
		discussion: [],
		apply_when: gate,
		time_sessions: [],
		allow_step_overlap: template.allow_step_overlap === true,
	};
	list.push(newInst);

	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: list, updated_at: now });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

export async function removeVehicleWorkPathInstance(vehicleId, instanceId) {
	if (!sanity) throw new Error("Sanity not configured");
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`,
		{
			id: vehicleId,
		},
	);
	let list = normalizeVehicleWorkflowInstances(v);
	list = list.filter((x) => x.instance_id !== instanceId);
	const t = new Date().toISOString();
	if (!list.length) {
		await sanity.patch(vehicleId).unset(["ops_workflows"]).commit();
		await sanity.patch(vehicleId).unset(["ops_workflow"]).commit();
		await sanity.patch(vehicleId).set({ updated_at: t }).commit();
		return;
	}
	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: list, updated_at: t });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

/** @deprecated use removeVehicleWorkPathInstance; clears legacy single workflow only */
export async function clearVehicleWorkPath(vehicleId) {
	if (!sanity) throw new Error("Sanity not configured");
	const t = new Date().toISOString();
	await sanity.patch(vehicleId).unset(["ops_workflows"]).commit();
	await sanity.patch(vehicleId).unset(["ops_workflow"]).commit();
	await sanity.patch(vehicleId).set({ updated_at: t }).commit();
}

/**
 * @param {string} vehicleId
 * @param {string|null} instanceId — null = legacy single workflow
 * @param {string} firebaseUid
 * @param {{ override?: boolean, step_key?: string }} opts — `step_key` required when instance has `allow_step_overlap`
 */
export async function completeVehicleWorkPathStep(
	vehicleId,
	instanceId,
	firebaseUid,
	opts = {},
) {
	if (!sanity) throw new Error("Sanity not configured");
	const override = !!opts.override;
	const requestedStepKey =
		opts.step_key != null && String(opts.step_key).trim() !== ""
			? String(opts.step_key)
			: null;
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`,
		{
			id: vehicleId,
		},
	);
	let list = normalizeVehicleWorkflowInstances(v);
	if (!list.length) throw new Error("No work path on this vehicle");

	let wi = instanceId
		? list.findIndex((x) => x.instance_id === instanceId)
		: -1;
	if (wi < 0) wi = list.findIndex((x) => x.status === "active");
	if (wi < 0) wi = list.length === 1 ? 0 : -1;
	if (wi < 0) throw new Error("Work path instance not found");

	const w = list[wi];
	if (!w || w.status !== "active") throw new Error("No active work path");
	if (w.deadline_at && new Date(w.deadline_at).getTime() < Date.now()) {
		throw new Error("This work path is past its deadline");
	}

	const steps = w.steps || [];
	if (!steps.length) throw new Error("Invalid work path");
	const parallel = w.allow_step_overlap === true;

	let idx;
	if (parallel) {
		if (!requestedStepKey)
			throw new Error("Step is required for parallel (overlap) work paths");
		idx = steps.findIndex(
			(s, i) => workflowInstanceStepKey(steps, i) === requestedStepKey,
		);
		if (idx < 0) throw new Error("Step not found");
	} else {
		idx = Number(w.current_step_index) || 0;
		if (idx >= steps.length) throw new Error("Work path already finished");
		if (requestedStepKey) {
			const expect = workflowInstanceStepKey(steps, idx);
			if (requestedStepKey !== expect)
				throw new Error("Out of sequence — complete the current step first");
		}
	}

	const step = steps[idx];
	if (!step) throw new Error("Invalid step");
	if (!override && step.assignee_uid !== firebaseUid) {
		throw new Error("Only the assigned person can complete this step");
	}

	const stepKey = workflowInstanceStepKey(steps, idx);
	const doneKeys = new Set((w.completed_steps || []).map((c) => c.step_key));
	if (doneKeys.has(stepKey)) throw new Error("This step is already completed");

	const pendingChecklist = stepChecklistPending(step);
	if (pendingChecklist != null) {
		throw new Error(
			"Complete every checklist item on this step before marking it done",
		);
	}

	const now = new Date().toISOString();
	const stepStarted = parallel
		? w.started_at || now
		: w.current_step_started_at || w.started_at || now;

	const completed = [
		...(w.completed_steps || []),
		{
			step_key: stepKey,
			started_at: stepStarted,
			completed_at: now,
			completed_by_uid: firebaseUid,
		},
	];

	const doneSet = new Set(completed.map((c) => c.step_key));
	const allDone = steps.every((s, i) =>
		doneSet.has(workflowInstanceStepKey(steps, i)),
	);
	let nextIdx;
	if (allDone) {
		nextIdx = steps.length;
	} else {
		nextIdx = steps.findIndex(
			(s, i) => !doneSet.has(workflowInstanceStepKey(steps, i)),
		);
		if (nextIdx < 0) nextIdx = steps.length;
	}

	const nextInst = {
		...w,
		time_sessions: closeOpenTimeSessionsForUser(w, firebaseUid, now),
		completed_steps: completed,
		current_step_index: nextIdx,
		status: allDone ? "done" : "active",
		current_step_started_at: allDone ? null : parallel ? null : now,
		...(allDone ? { finished_at: now } : {}),
	};
	list[wi] = nextInst;

	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: list, updated_at: now });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

/**
 * Toggle a checklist row on an active workflow step (text or photo task).
 * @param {string} vehicleId
 * @param {string} instanceId
 * @param {string} firebaseUid
 * @param {{ step_key: string, subtask_key: string, done?: boolean, override?: boolean }} opts
 */
export async function setWorkPathStepSubtaskDone(
	vehicleId,
	instanceId,
	firebaseUid,
	opts = {},
) {
	if (!sanity) throw new Error("Sanity not configured");
	const override = !!opts.override;
	const stepKey =
		opts.step_key != null && String(opts.step_key).trim() !== ""
			? String(opts.step_key)
			: null;
	const subtaskKey =
		opts.subtask_key != null && String(opts.subtask_key).trim() !== ""
			? String(opts.subtask_key)
			: null;
	const done = opts.done !== false;
	if (!firebaseUid) throw new Error("Not signed in");
	if (!stepKey || !subtaskKey) throw new Error("Missing checklist item");

	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`,
		{
			id: vehicleId,
		},
	);
	let list = normalizeVehicleWorkflowInstances(v);
	const wi = list.findIndex((x) => x.instance_id === instanceId);
	if (wi < 0) throw new Error("Work path instance not found");

	const w = { ...list[wi] };
	if (w.status !== "active") throw new Error("Work path is not active");
	if (w.deadline_at && new Date(w.deadline_at).getTime() < Date.now()) {
		throw new Error("This work path is past its deadline");
	}

	const steps = (w.steps || []).map((x) => ({
		...x,
		subtasks: (x.subtasks || []).map((t) => ({ ...t })),
	}));
	const stepIdx = steps.findIndex(
		(s, i) => workflowInstanceStepKey(steps, i) === stepKey,
	);
	if (stepIdx < 0) throw new Error("Step not found");
	const step = steps[stepIdx];
	const doneStepKeys = new Set(
		(w.completed_steps || []).map((c) => c.step_key),
	);
	if (doneStepKeys.has(stepKey))
		throw new Error("This step is already completed");

	if (!override && step.assignee_uid !== firebaseUid) {
		throw new Error("Only the assignee can update this checklist");
	}

	const subs = [...(step.subtasks || [])];
	const stIdx = subs.findIndex((t) => t._key === subtaskKey);
	if (stIdx < 0) throw new Error("Checklist item not found");
	subs[stIdx] = { ...subs[stIdx], done };
	steps[stepIdx] = { ...step, subtasks: subs };
	list[wi] = { ...w, steps };

	const now = new Date().toISOString();
	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: list, updated_at: now });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

export async function startWorkPathTimeSession(vehicleId, instanceId, payload) {
	if (!sanity) throw new Error("Sanity not configured");
	const userUid = payload?.user_uid;
	const user_display_name = (payload?.user_display_name || "").trim() || null;
	const payloadStepKey =
		payload?.step_key != null && String(payload.step_key).trim() !== ""
			? String(payload.step_key)
			: null;
	if (!userUid) throw new Error("Not signed in");

	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`,
		{
			id: vehicleId,
		},
	);
	let list = normalizeVehicleWorkflowInstances(v);
	const wi = list.findIndex((x) => x.instance_id === instanceId);
	if (wi < 0) throw new Error("Work path instance not found");

	const inst = { ...list[wi] };
	if (inst.status !== "active") throw new Error("Work path is not active");
	if (inst.deadline_at && new Date(inst.deadline_at).getTime() < Date.now()) {
		throw new Error("This work path is past its deadline");
	}

	const steps = inst.steps || [];
	const parallel = inst.allow_step_overlap === true;
	let idx;
	let cur;
	if (parallel) {
		if (!payloadStepKey)
			throw new Error("Step is required to start work on parallel paths");
		idx = steps.findIndex(
			(s, i) => workflowInstanceStepKey(steps, i) === payloadStepKey,
		);
		if (idx < 0) throw new Error("Step not found");
		cur = steps[idx];
		const done = completedStepKeysSet(inst);
		if (done.has(payloadStepKey))
			throw new Error("This step is already completed");
	} else {
		idx = Number(inst.current_step_index) || 0;
		cur = steps[idx];
		if (payloadStepKey) {
			const expect = workflowInstanceStepKey(steps, idx);
			if (payloadStepKey !== expect)
				throw new Error("Only the current step can be started");
		}
	}
	if (!cur || cur.assignee_uid !== userUid) {
		throw new Error("Only the assignee for this step can start time tracking");
	}

	const sessions = [...(inst.time_sessions || [])];
	const targetKey = workflowInstanceStepKey(steps, idx);
	if (sessions.some((s) => s.user_uid === userUid && !s.ended_at)) {
		throw new Error(
			"Finish your in-progress step before starting another timer",
		);
	}

	const now = new Date().toISOString();
	sessions.push({
		_key: randomWorkflowInstanceId().replace(/-/g, "").slice(0, 12),
		step_key: targetKey,
		step_title: cur.title || "",
		user_uid: userUid,
		user_display_name,
		started_at: now,
		ended_at: null,
	});
	inst.time_sessions = sessions;
	list[wi] = inst;

	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: list, updated_at: now });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

export async function endWorkPathTimeSession(
	vehicleId,
	instanceId,
	userUid,
	stepKey = null,
) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!userUid) throw new Error("Not signed in");

	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`,
		{
			id: vehicleId,
		},
	);
	let list = normalizeVehicleWorkflowInstances(v);
	const wi = list.findIndex((x) => x.instance_id === instanceId);
	if (wi < 0) throw new Error("Work path instance not found");

	const inst = { ...list[wi] };
	const now = new Date().toISOString();
	const sessions = [...(inst.time_sessions || [])];
	const sk =
		stepKey != null && String(stepKey).trim() !== "" ? String(stepKey) : null;
	const openIdx = [...sessions.entries()]
		.filter(
			([, s]) =>
				s.user_uid === userUid &&
				!s.ended_at &&
				(sk == null || s.step_key === sk),
		)
		.sort(
			(a, b) =>
				new Date(b[1].started_at || 0).getTime() -
				new Date(a[1].started_at || 0).getTime(),
		)[0]?.[0];
	if (openIdx === undefined) throw new Error("No active timer to end");
	sessions[openIdx] = { ...sessions[openIdx], ended_at: now };

	inst.time_sessions = sessions;
	list[wi] = inst;

	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: list, updated_at: now });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

export async function addWorkPathDiscussionMessage(
	vehicleId,
	instanceId,
	payload,
) {
	if (!sanity) throw new Error("Sanity not configured");
	const {
		author_uid,
		author_name,
		body,
		parent_key,
		visibility,
		target_uid,
		target_name,
	} = payload;
	if (!body?.trim()) throw new Error("Message is required");
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`,
		{
			id: vehicleId,
		},
	);
	let list = normalizeVehicleWorkflowInstances(v);
	const wi = list.findIndex((x) => x.instance_id === instanceId);
	if (wi < 0) throw new Error("Work path instance not found");
	const inst = { ...list[wi] };
	const isDirect =
		visibility === "direct" && String(target_uid || "").trim() !== "";
	const msg = {
		_key: randomWorkflowInstanceId().replace(/-/g, "").slice(0, 12),
		author_uid: author_uid || "",
		author_name: author_name || "",
		body: body.trim(),
		created_at: new Date().toISOString(),
		parent_key: parent_key || null,
		visibility: isDirect ? "direct" : "all",
		target_uid: isDirect ? String(target_uid) : null,
		target_name: isDirect ? String(target_name || "") || null : null,
	};
	inst.discussion = [...(inst.discussion || []), msg];
	list[wi] = inst;
	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: list, updated_at: new Date().toISOString() });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

function collectDiscussionDescendantKeys(discussion, rootKey) {
	const byParent = new Map();
	for (const m of discussion || []) {
		const pk = m.parent_key;
		if (!pk) continue;
		if (!byParent.has(pk)) byParent.set(pk, []);
		byParent.get(pk).push(m._key);
	}
	const remove = new Set([rootKey]);
	const stack = [rootKey];
	while (stack.length) {
		const k = stack.pop();
		for (const c of byParent.get(k) || []) {
			if (!remove.has(c)) {
				remove.add(c);
				stack.push(c);
			}
		}
	}
	return remove;
}

/** Author may delete their own message; removes that message and all replies beneath it. */
export async function deleteWorkPathDiscussionMessage(
	vehicleId,
	instanceId,
	messageKey,
	requesterUid,
) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!messageKey || !requesterUid) throw new Error("Not allowed");
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`,
		{
			id: vehicleId,
		},
	);
	let list = normalizeVehicleWorkflowInstances(v);
	const wi = list.findIndex((x) => x.instance_id === instanceId);
	if (wi < 0) throw new Error("Work path instance not found");
	const inst = { ...list[wi] };
	const discussion = inst.discussion || [];
	const msg = discussion.find((m) => m._key === messageKey);
	if (!msg) throw new Error("Message not found");
	if (msg.author_uid !== requesterUid)
		throw new Error("You can only delete your own messages");
	const drop = collectDiscussionDescendantKeys(discussion, messageKey);
	inst.discussion = discussion.filter((m) => !drop.has(m._key));
	list[wi] = inst;
	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: list, updated_at: new Date().toISOString() });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

export async function reorderVehicleWorkflowInstances(
	vehicleId,
	orderedInstanceIds,
) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!Array.isArray(orderedInstanceIds) || !orderedInstanceIds.length) return;
	const v = await sanity.fetch(
		`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`,
		{
			id: vehicleId,
		},
	);
	const list = normalizeVehicleWorkflowInstances(v);
	const map = new Map(list.map((x) => [x.instance_id, { ...x }]));
	const reordered = [];
	orderedInstanceIds.forEach((id, i) => {
		const item = map.get(id);
		if (item) {
			item.sort_order = i;
			reordered.push(item);
			map.delete(id);
		}
	});
	for (const [, rest] of map) reordered.push(rest);
	reordered.sort(
		(a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0),
	);
	const patch = sanity
		.patch(vehicleId)
		.set({ ops_workflows: reordered, updated_at: new Date().toISOString() });
	if (v?.ops_workflow) patch.unset(["ops_workflow"]);
	await patch.commit();
}

export async function fetchVehiclesWithWorkflows() {
	if (!sanity) return [];
	const docs = await sanity.fetch(
		`*[_type == "vehicle" && (defined(ops_workflows) || defined(ops_workflow)) && sold != true] ${vehicleProjection}`,
	);
	return (docs || []).map(sanityVehicleToApp);
}

const analyticsWorkflowProjection = `{
  _id,
  brand,
  model,
  stock_id,
  sold,
  reserved,
  ops_workflows,
  ops_workflow,
  _updatedAt
}`;

/** Rows for ops analytics (time tracking, path coverage). */
export async function fetchVehiclesWithWorkPathAnalytics(limit = 500) {
	if (!sanity) return [];
	const lim = Math.min(Math.max(1, Number(limit) || 500), 1000);
	return sanity.fetch(
		`*[_type == "vehicle" && (defined(ops_workflows) || defined(ops_workflow))] | order(_updatedAt desc) [0...${lim}] ${analyticsWorkflowProjection}`,
	);
}

/** Sold rows for timeline charts (_updatedAt ≈ when marked sold in CMS). */
export async function fetchSoldVehiclesAnalyticsTimeline(limit = 400) {
	if (!sanity) return [];
	const lim = Math.min(Math.max(1, Number(limit) || 400), 1000);
	return sanity.fetch(
		`*[_type == "vehicle" && sold == true] | order(_updatedAt desc) [0...${lim}] {
      _id,
      brand,
      model,
      _updatedAt
    }`,
	);
}

// --- Users / Roles (admin) ---

export async function fetchAllUserProfiles() {
	if (!sanity) return [];
	await ensureBootstrap();
	const rows = await sanity.fetch(
		`*[_type == "userProfile"] | order(_createdAt asc) {
      "id": _id,
      "user_id": firebase_uid,
      firebase_uid,
      email,
      display_name,
      "role_id": role._ref,
      "role": role->{ _id, name, description },
      "created_at": _createdAt
    }`,
	);
	const seen = new Set();
	const deduped = [];
	for (const row of rows || []) {
		const k = row.firebase_uid || row.user_id;
		if (!k || seen.has(k)) continue;
		seen.add(k);
		deduped.push(row);
	}
	deduped.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
	return deduped;
}

export async function fetchAllRoles() {
	if (!sanity) return [];
	await ensureBootstrap();
	return sanity.fetch(`*[_type == "role"] | order(name) {
    "id": _id,
    name,
    description,
    is_system,
    permission_ids
  }`);
}

export async function fetchAllPermissions() {
	if (!sanity) return [];
	await ensureBootstrap();
	return sanity.fetch(`*[_type == "permission"] | order(category asc, sort_order asc) {
    "id": _id,
    code,
    label,
    category,
    sort_order
  }`);
}

export async function createUserProfileDoc({
	firebase_uid,
	email,
	display_name,
	role_id,
}) {
	if (!sanity) throw new Error("Sanity not configured");
	const existingId = await sanity.fetch(
		`*[_type == "userProfile" && firebase_uid == $uid]{ _id } | order(_createdAt asc)[0]._id`,
		{ uid: firebase_uid },
	);
	const _id = existingId || userProfileDocumentId(firebase_uid);

	if (!existingId) {
		await sanity.createIfNotExists({
			_id,
			_type: "userProfile",
			firebase_uid,
			email: email || "",
			display_name: display_name || "",
			role: { _type: "reference", _ref: role_id },
			created_at: new Date().toISOString(),
		});
	}

	await sanity
		.patch(_id)
		.set({
			email: email || "",
			display_name: display_name || "",
			role: { _type: "reference", _ref: role_id },
			updated_at: new Date().toISOString(),
		})
		.commit();
}

export async function updateUserProfileDoc(
	profileSanityId,
	{ display_name, role_id },
) {
	if (!sanity) throw new Error("Sanity not configured");
	const patch = sanity
		.patch(profileSanityId)
		.set({ updated_at: new Date().toISOString() });
	if (display_name !== undefined) patch.set({ display_name });
	if (role_id) patch.set({ role: { _type: "reference", _ref: role_id } });
	await patch.commit();
}

const MAX_FCM_WEB_TOKENS = 8;

/** Store FCM web tokens on the Sanity user profile for Cloud Messaging (Firebase Functions, etc.). */
export async function mergeFcmWebTokenIntoProfile(profileSanityId, token) {
	if (!sanity || !profileSanityId || !token || String(token).length < 20)
		return;
	const doc = await sanity.fetch(
		`*[_type == "userProfile" && _id == $id][0]{ fcm_web_tokens }`,
		{
			id: profileSanityId,
		},
	);
	const existing = Array.isArray(doc?.fcm_web_tokens)
		? doc.fcm_web_tokens.filter(Boolean)
		: [];
	const next = [...new Set([String(token), ...existing])].slice(
		0,
		MAX_FCM_WEB_TOKENS,
	);
	await sanity
		.patch(profileSanityId)
		.set({ fcm_web_tokens: next, updated_at: new Date().toISOString() })
		.commit();
}

export async function removeFcmWebTokenFromProfile(profileSanityId, token) {
	if (!sanity || !profileSanityId || !token) return;
	const doc = await sanity.fetch(
		`*[_type == "userProfile" && _id == $id][0]{ fcm_web_tokens }`,
		{
			id: profileSanityId,
		},
	);
	const existing = Array.isArray(doc?.fcm_web_tokens)
		? doc.fcm_web_tokens.filter(Boolean)
		: [];
	const next = existing.filter((t) => t !== token);
	await sanity
		.patch(profileSanityId)
		.set({ fcm_web_tokens: next, updated_at: new Date().toISOString() })
		.commit();
}

export async function deleteUserProfileDoc(profileSanityId) {
	if (!sanity) throw new Error("Sanity not configured");
	await sanity.delete(profileSanityId);
}

export async function updateRolePermissions(roleId, permissionIds) {
	if (!sanity) throw new Error("Sanity not configured");
	await sanity
		.patch(roleId)
		.set({
			permission_ids: permissionIds,
			updated_at: new Date().toISOString(),
		})
		.commit();
}

export async function sanityPing() {
	if (!sanity) return { ok: false, error: "Not configured" };
	try {
		await sanity.fetch('count(*[_type == "vehicle"])');
		return { ok: true, error: null };
	} catch (e) {
		return { ok: false, error: e.message };
	}
}

/** Vehicles that have at least one viewing row (for staff notifications). */
export async function fetchVehiclesWithScheduledViewings() {
	if (!sanity) return [];
	return sanity.fetch(
		`*[_type == "vehicle" && sold == false && defined(viewing_bookings) && count(viewing_bookings) > 0]{
      _id,
      stock_id,
      brand,
      model,
      viewing_bookings
    }`,
	);
}

/** MOT / delivery notifications */
export async function fetchVehiclesForNotifications() {
	if (!sanity) return [];
	return sanity.fetch(
		`*[_type == "vehicle" && sold == false]{
      _id,
      stock_id,
      brand,
      model,
      planned_collection_date,
      mot_expiry_date,
      reserved,
      sold
    }`,
	);
}

export async function fetchMotVehiclesForNotifications() {
	if (!sanity) return [];
	return sanity.fetch(
		`*[_type == "vehicle" && sold == false && defined(mot_expiry_date)]{
      _id,
      stock_id,
      brand,
      model,
      mot_expiry_date
    }`,
	);
}

export async function fetchVehicleIdsHavingReservationSteps(stepKeys, vehicleIds) {
	if (!sanity || !vehicleIds?.length || !stepKeys?.length) return new Set();
	const rows = await sanity.fetch(
		`*[_type == "reservationWorkflowUpdate" && step_key in $steps && vehicle_id in $ids].vehicle_id`,
		{ steps: stepKeys, ids: vehicleIds },
	);
	return new Set(rows || []);
}

/** Reserved vehicles whose manager approved PDI (customer-visible gate). */
export async function fetchPdiApprovedVehicleIds(reservedIds) {
	return fetchVehicleIdsHavingReservationSteps(["pdi_approved"], reservedIds);
}

// --- Workshop / service bookings (separate line of business — not tied to inventory status) ---
/**
 * Sanity document type suggested in README: workshopService (add in Studio).
 * App writes tolerate missing Studio schema via API.
 */
export function workshopServiceDocumentId() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) {
		return `workshopService.${crypto.randomUUID()}`;
	}
	return `workshopService.${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeWorkshopService(doc) {
	if (!doc?._id) return null;
	const ref =
		doc.inventory_vehicle?._ref ||
		doc.inventory_vehicle?._id ||
		(doc.inventory_vehicle && String(doc.inventory_vehicle)) ||
		"";
	const dm = Number(doc.duration_minutes);
	return {
		id: doc._id,
		is_asahi_customer: doc.is_asahi_customer === true,
		inventory_vehicle_id: ref || null,
		customer_name: String(doc.customer_name || "").trim(),
		customer_phone: String(doc.customer_phone || "").trim(),
		customer_email: String(doc.customer_email || "").trim(),
		vehicle_make: String(doc.vehicle_make || "").trim(),
		vehicle_model: String(doc.vehicle_model || "").trim(),
		plate: String(doc.plate || "").trim(),
		scheduled_at: doc.scheduled_at || "",
		duration_minutes: Number.isFinite(dm) && dm > 0 ? dm : 60,
		location: String(doc.location || "").trim(),
		mechanic_firebase_uid: String(doc.mechanic_firebase_uid || ""),
		sales_firebase_uid: String(doc.sales_firebase_uid || ""),
		notes: String(doc.notes || "").trim(),
		status: ["scheduled", "completed", "cancelled"].includes(doc.status)
			? doc.status
			: "scheduled",
		completed_at: doc.completed_at || "",
		cancelled_at: doc.cancelled_at || "",
		created_by_firebase_uid: String(doc.created_by_firebase_uid || ""),
		created_by_name: String(doc.created_by_name || "").trim(),
		created_at: doc.created_at || "",
		updated_at: doc.updated_at || "",
	};
}

export async function fetchWorkshopServicesBetween(fromIso, toIso) {
	if (!sanity) return [];
	await ensureBootstrap();
	const from =
		fromIso instanceof Date ? fromIso.toISOString() : String(fromIso || "");
	const to = toIso instanceof Date ? toIso.toISOString() : String(toIso || "");
	if (!from || !to) return [];
	const docs = await sanity.fetch(
		`*[_type == "workshopService" && scheduled_at >= $from && scheduled_at <= $to] | order(scheduled_at asc){
      ...,
      inventory_vehicle->{ _id }
    }`,
		{ from, to },
	);
	return (docs || []).map(normalizeWorkshopService).filter(Boolean);
}

/** Scheduled-only, date range — calendar + active upcoming window */
export async function fetchWorkshopServicesScheduledBetween(fromIso, toIso) {
	if (!sanity) return [];
	await ensureBootstrap();
	const from =
		fromIso instanceof Date ? fromIso.toISOString() : String(fromIso || "");
	const to = toIso instanceof Date ? toIso.toISOString() : String(toIso || "");
	if (!from || !to) return [];
	const docs = await sanity.fetch(
		`*[_type == "workshopService" && status == "scheduled" && scheduled_at >= $from && scheduled_at <= $to] | order(scheduled_at asc){
      ...,
      inventory_vehicle->{ _id }
    }`,
		{ from, to },
	);
	return (docs || []).map(normalizeWorkshopService).filter(Boolean);
}

const WS_PAGE_MAX = 50;

export async function countWorkshopServicesScheduled() {
	if (!sanity) return 0;
	await ensureBootstrap();
	const n = await sanity.fetch(
		'count(*[_type == "workshopService" && status == "scheduled"])',
	);
	return typeof n === "number" ? n : 0;
}

export async function fetchWorkshopServicesScheduledPage(page, pageSize) {
	if (!sanity) return [];
	await ensureBootstrap();
	const ps = Math.min(
		Math.max(Number(pageSize) || 12, 1),
		WS_PAGE_MAX,
	);
	const p = Math.max(Number(page) || 1, 1);
	const start = (p - 1) * ps;
	const end = start + ps;
	const docs = await sanity.fetch(
		`*[_type == "workshopService" && status == "scheduled"] | order(scheduled_at asc) [$start...$end]{
      ...,
      inventory_vehicle->{ _id }
    }`,
		{ start, end },
	);
	return (docs || []).map(normalizeWorkshopService).filter(Boolean);
}

export async function countWorkshopServicesPast() {
	if (!sanity) return 0;
	await ensureBootstrap();
	const n = await sanity.fetch(
		'count(*[_type == "workshopService" && status in ["completed","cancelled"]])',
	);
	return typeof n === "number" ? n : 0;
}

export async function fetchWorkshopServicesPastPage(page, pageSize) {
	if (!sanity) return [];
	await ensureBootstrap();
	const ps = Math.min(
		Math.max(Number(pageSize) || 15, 1),
		WS_PAGE_MAX,
	);
	const p = Math.max(Number(page) || 1, 1);
	const start = (p - 1) * ps;
	const end = start + ps;
	const docs = await sanity.fetch(
		`*[_type == "workshopService" && status in ["completed","cancelled"]] | order(coalesce(completed_at, cancelled_at, updated_at) desc) [$start...$end]{
      ...,
      inventory_vehicle->{ _id }
    }`,
		{ start, end },
	);
	return (docs || []).map(normalizeWorkshopService).filter(Boolean);
}

/** Notification feed — scheduled jobs only in a local window around “today” */
export async function fetchWorkshopServicesAroundToday() {
	const from = new Date();
	from.setHours(0, 0, 0, 0);
	from.setDate(from.getDate() - 3);
	const to = new Date();
	to.setHours(23, 59, 59, 999);
	to.setDate(to.getDate() + 14);
	return fetchWorkshopServicesScheduledBetween(
		from.toISOString(),
		to.toISOString(),
	);
}

function workshopServiceMutationDoc(input, extras = {}) {
	const now = new Date().toISOString();
	const dm = Number(input.duration_minutes);
	const dur =
		Number.isFinite(dm) && dm > 5 && dm <= 24 * 60 ? Math.floor(dm) : 60;
	const inv = input.inventory_vehicle_id
		? { _type: "reference", _ref: input.inventory_vehicle_id }
		: undefined;
	const core = {
		_type: "workshopService",
		is_asahi_customer: !!input.is_asahi_customer,
		customer_name: String(input.customer_name || "").trim(),
		customer_phone: String(input.customer_phone || "").trim(),
		customer_email: String(input.customer_email || "").trim(),
		vehicle_make: String(input.vehicle_make || "").trim(),
		vehicle_model: String(input.vehicle_model || "").trim(),
		plate: String(input.plate || "").trim(),
		scheduled_at: input.scheduled_at,
		duration_minutes: dur,
		location: String(input.location || "").trim(),
		mechanic_firebase_uid: String(input.mechanic_firebase_uid || ""),
		sales_firebase_uid: String(input.sales_firebase_uid || ""),
		notes: String(input.notes || "").trim(),
		status:
			input.status === "completed" || input.status === "cancelled"
				? input.status
				: "scheduled",
		updated_at: now,
	};
	if (inv) core.inventory_vehicle = inv;
	Object.assign(core, extras);
	return core;
}

export async function createWorkshopService(payload) {
	if (!sanity) throw new Error("Sanity not configured");
	await ensureBootstrap();
	const now = new Date().toISOString();
	const created = workshopServiceMutationDoc(payload, {
		...(payload.created_by_firebase_uid
			? { created_by_firebase_uid: payload.created_by_firebase_uid }
			: {}),
		...(payload.created_by_name
			? { created_by_name: payload.created_by_name }
			: {}),
		created_at: now,
	});
	if (!created.scheduled_at) throw new Error("Date and time are required.");
	if (
		payload.is_asahi_customer &&
		!String(payload.inventory_vehicle_id || "").trim()
	) {
		throw new Error("Select an inventory vehicle for Asahi customers.");
	}
	if (!payload.is_asahi_customer) {
		if (
			!String(payload.vehicle_make || "").trim() ||
			!String(payload.vehicle_model || "").trim()
		) {
			throw new Error("Vehicle make and model are required for walk-in guests.");
		}
	}
	if (!created.customer_name) throw new Error("Customer name is required.");
	const doc = {
		...created,
		_id: workshopServiceDocumentId(),
	};
	if (!doc.inventory_vehicle) delete doc.inventory_vehicle;
	await sanity.create(doc);
	return doc._id;
}

export async function updateWorkshopService(id, patchInput) {
	if (!sanity) throw new Error("Sanity not configured");
	if (!id) throw new Error("Missing document id.");
	const now = new Date().toISOString();
	const dm = Number(patchInput.duration_minutes);
	const dur =
		Number.isFinite(dm) && dm > 5 && dm <= 24 * 60 ? Math.floor(dm) : undefined;
	const setFields = {
		updated_at: now,
		...(patchInput.is_asahi_customer !== undefined
			? { is_asahi_customer: !!patchInput.is_asahi_customer }
			: {}),
		...(patchInput.customer_name !== undefined
			? { customer_name: String(patchInput.customer_name || "").trim() }
			: {}),
		...(patchInput.customer_phone !== undefined
			? { customer_phone: String(patchInput.customer_phone || "").trim() }
			: {}),
		...(patchInput.customer_email !== undefined
			? { customer_email: String(patchInput.customer_email || "").trim() }
			: {}),
		...(patchInput.vehicle_make !== undefined
			? { vehicle_make: String(patchInput.vehicle_make || "").trim() }
			: {}),
		...(patchInput.vehicle_model !== undefined
			? { vehicle_model: String(patchInput.vehicle_model || "").trim() }
			: {}),
		...(patchInput.plate !== undefined
			? { plate: String(patchInput.plate || "").trim() }
			: {}),
		...(patchInput.scheduled_at !== undefined
			? { scheduled_at: patchInput.scheduled_at }
			: {}),
		...(dur !== undefined ? { duration_minutes: dur } : {}),
		...(patchInput.location !== undefined
			? { location: String(patchInput.location || "").trim() }
			: {}),
		...(patchInput.mechanic_firebase_uid !== undefined
			? { mechanic_firebase_uid: String(patchInput.mechanic_firebase_uid || "") }
			: {}),
		...(patchInput.sales_firebase_uid !== undefined
			? { sales_firebase_uid: String(patchInput.sales_firebase_uid || "") }
			: {}),
		...(patchInput.notes !== undefined
			? { notes: String(patchInput.notes || "").trim() }
			: {}),
	};
	const statusNext =
		patchInput.status !== undefined
			? ["scheduled", "completed", "cancelled"].includes(patchInput.status)
				? patchInput.status
				: "scheduled"
			: undefined;
	if (statusNext !== undefined) {
		setFields.status = statusNext;
	}
	if (statusNext === "completed") {
		setFields.completed_at = patchInput.completed_at || now;
	}
	if (statusNext === "cancelled") {
		setFields.cancelled_at = patchInput.cancelled_at || now;
	}
	if (
		Object.prototype.hasOwnProperty.call(patchInput, "inventory_vehicle_id")
	) {
		const ref = String(patchInput.inventory_vehicle_id || "").trim();
		if (ref) {
			setFields.inventory_vehicle = { _type: "reference", _ref: ref };
		}
	}
	let patchChain = sanity.patch(id).set(setFields);
	if (
		Object.prototype.hasOwnProperty.call(patchInput, "inventory_vehicle_id") &&
		!String(patchInput.inventory_vehicle_id || "").trim()
	) {
		patchChain = patchChain.unset(["inventory_vehicle"]);
	}

	await patchChain.commit();
}
