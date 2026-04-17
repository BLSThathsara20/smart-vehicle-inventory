import { sanity } from './sanity'
import { vehicleMeetsApplyWhen } from './workflowApplyRules'

/** One successful bootstrap per page load — avoids re-running ~10+ Sanity writes on every auth callback. */
let bootstrapPromise = null
let bootstrapSucceeded = false

/** Permission bundles for seeded / ensured built-in roles (single source of truth). */
const PERMS_GUEST = ['perm-inventory-view']
const PERMS_HELPER = ['perm-inventory-view', 'perm-search-view', 'perm-settings-view']
const PERMS_MARKETER = [
  'perm-inventory-view',
  'perm-inventory-edit',
  'perm-search-view',
  'perm-settings-view',
]
const PERMS_WORKER = [
  'perm-inventory-view',
  'perm-inventory-add',
  'perm-inventory-edit',
  'perm-search-view',
  'perm-settings-view',
]
const PERMS_MANAGER = [
  'perm-inventory-view',
  'perm-inventory-add',
  'perm-inventory-edit',
  'perm-inventory-delete',
  'perm-search-view',
  'perm-health-view',
  'perm-space-view',
  'perm-settings-view',
]

/** Keeps built-in guest role in sync (inventory view only). Safe to call on every bootstrap. */
async function syncBuiltinGuestRole() {
  if (!sanity) return
  await sanity.createOrReplace({
    _id: 'role-guest',
    _type: 'role',
    name: 'guest',
    description: 'Default for new sign-ins: view inventory only (no edits)',
    is_system: true,
    permission_ids: PERMS_GUEST,
  })
}

/** Ensures manager / worker / helper / marketer exist on existing datasets without overwriting edits. */
async function ensureExtendedBuiltinRoles() {
  if (!sanity) return
  const defs = [
    {
      _id: 'role-manager',
      name: 'manager',
      description:
        'Operations lead: full inventory, search, notifications, health & storage (no user/role admin)',
      permission_ids: PERMS_MANAGER,
    },
    {
      _id: 'role-worker',
      name: 'worker',
      description: 'Floor staff: add and update vehicles, search & settings',
      permission_ids: PERMS_WORKER,
    },
    {
      _id: 'role-helper',
      name: 'helper',
      description: 'Support: browse inventory and search (no edits)',
      permission_ids: PERMS_HELPER,
    },
    {
      _id: 'role-marketer',
      name: 'marketer',
      description: 'Listings & ads: view inventory, edit vehicles, search',
      permission_ids: PERMS_MARKETER,
    },
  ]
  await Promise.all(
    defs.map((d) =>
      sanity.createIfNotExists({
        _id: d._id,
        _type: 'role',
        name: d.name,
        description: d.description,
        is_system: false,
        permission_ids: d.permission_ids,
      })
    )
  )
}

async function runEnsureBootstrap() {
  if (!sanity) return
  const count = await sanity.fetch('count(*[_type == "permission"])')
  if (count === 0) {
       const permissions = [
         { _id: 'perm-inventory-view', code: 'inventory:view', label: 'View inventory', category: 'Inventory', sort_order: 1 },
         { _id: 'perm-inventory-add', code: 'inventory:add', label: 'Add vehicles', category: 'Inventory', sort_order: 2 },
         { _id: 'perm-inventory-edit', code: 'inventory:edit', label: 'Edit vehicles', category: 'Inventory', sort_order: 3 },
         { _id: 'perm-inventory-delete', code: 'inventory:delete', label: 'Delete vehicles', category: 'Inventory', sort_order: 4 },
         { _id: 'perm-search-view', code: 'search:view', label: 'Search vehicles', category: 'Search', sort_order: 10 },
         { _id: 'perm-health-view', code: 'health:view', label: 'View app health', category: 'System', sort_order: 20 },
         { _id: 'perm-space-view', code: 'space:view', label: 'View storage & space', category: 'System', sort_order: 21 },
         { _id: 'perm-settings-view', code: 'settings:view', label: 'View settings', category: 'System', sort_order: 22 },
         { _id: 'perm-roles-manage', code: 'roles:manage', label: 'Manage roles & permissions', category: 'Admin', sort_order: 30 },
         { _id: 'perm-users-manage', code: 'users:manage', label: 'Manage users', category: 'Admin', sort_order: 31 },
         { _id: 'perm-workflows-manage', code: 'workflows:manage', label: 'Manage work paths', category: 'Admin', sort_order: 32 },
         { _id: 'perm-analytics-view', code: 'analytics:view', label: 'View analytics', category: 'Admin', sort_order: 33 },
       ]

       const allIds = permissions.map((p) => p._id)
       const noUsersManage = allIds.filter((id) => id !== 'perm-users-manage')
       const mechanicIds = PERMS_WORKER
       const viewerIds = PERMS_HELPER

       const roles = [
         {
           _id: 'role-super-admin',
           name: 'super_admin',
           description: 'Full system access',
           is_system: true,
           permission_ids: allIds,
         },
         {
           _id: 'role-admin',
           name: 'admin',
           description: 'Administrative access',
           is_system: false,
           permission_ids: noUsersManage,
         },
         {
           _id: 'role-mechanic',
           name: 'mechanic',
           description: 'Vehicle maintenance & inventory',
           is_system: false,
           permission_ids: mechanicIds,
         },
         {
           _id: 'role-viewer',
           name: 'viewer',
           description: 'Read-only search & inventory',
           is_system: false,
           permission_ids: viewerIds,
         },
         {
           _id: 'role-guest',
           name: 'guest',
           description: 'Default for new sign-ins: view inventory only (no edits)',
           is_system: true,
           permission_ids: PERMS_GUEST,
         },
         {
           _id: 'role-manager',
           name: 'manager',
           description:
             'Operations lead: full inventory, search, notifications, health & storage (no user/role admin)',
           is_system: false,
           permission_ids: PERMS_MANAGER,
         },
         {
           _id: 'role-worker',
           name: 'worker',
           description: 'Floor staff: add and update vehicles, search & settings',
           is_system: false,
           permission_ids: PERMS_WORKER,
         },
         {
           _id: 'role-helper',
           name: 'helper',
           description: 'Support: browse inventory and search (no edits)',
           is_system: false,
           permission_ids: PERMS_HELPER,
         },
         {
           _id: 'role-marketer',
           name: 'marketer',
           description: 'Listings & ads: view inventory, edit vehicles, search',
           is_system: false,
           permission_ids: PERMS_MARKETER,
         },
       ]

       await Promise.all(permissions.map((p) => sanity.createOrReplace({ _type: 'permission', ...p })))
       await Promise.all(
         roles.map((r) => {
           const { permission_ids, ...rest } = r
           return sanity.createOrReplace({ _type: 'role', ...rest, permission_ids })
         })
       )
  }

  await Promise.all([syncBuiltinGuestRole(), ensureExtendedBuiltinRoles()])
  await ensureAdminMigrationPermissions()
}

/**
 * Ensures newer permission docs exist and super_admin / admin roles include them.
 * Single pass per role avoids races from parallel patchers (workflows vs analytics).
 */
async function ensureAdminMigrationPermissions() {
  if (!sanity) return
  const defs = [
    {
      _id: 'perm-workflows-manage',
      _type: 'permission',
      code: 'workflows:manage',
      label: 'Manage work paths',
      category: 'Admin',
      sort_order: 32,
    },
    {
      _id: 'perm-analytics-view',
      _type: 'permission',
      code: 'analytics:view',
      label: 'View analytics',
      category: 'Admin',
      sort_order: 33,
    },
  ]
  await Promise.all(defs.map((doc) => sanity.createIfNotExists(doc)))
  const needIds = defs.map((d) => d._id)
  for (const rid of ['role-super-admin', 'role-admin']) {
    const role = await sanity.fetch(`*[_id == $id][0]{ permission_ids }`, { id: rid })
    const raw = role?.permission_ids
    const ids = Array.isArray(raw)
      ? raw.map((x) => (typeof x === 'string' ? x : x?._ref || x?.ref || String(x)))
      : []
    const merged = [...ids]
    let changed = false
    for (const pid of needIds) {
      if (!merged.includes(pid)) {
        merged.push(pid)
        changed = true
      }
    }
    if (changed) {
      await sanity.patch(rid).set({ permission_ids: merged }).commit()
    }
  }
}

/** Idempotent dataset setup; safe to call from many places — runs Sanity work at most once per page load. */
export async function ensureBootstrap() {
  if (!sanity) return
  if (bootstrapSucceeded) return
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await runEnsureBootstrap()
      bootstrapSucceeded = true
    })().finally(() => {
      bootstrapPromise = null
    })
  }
  await bootstrapPromise
}

export function sanityVehicleToApp(doc) {
  if (!doc) return null
  const images = (doc.images || [])
    .map((img, i) => ({
      id: img._key || `img-${i}`,
      url: img.url,
      sort_order: img.sortOrder ?? i,
    }))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  const { _id, _type, images: _im, ...rest } = doc
  return {
    ...rest,
    id: _id,
    images,
  }
}

export async function fetchProfileWithPermissions(firebaseUid) {
  if (!sanity || !firebaseUid) return null
  await ensureBootstrap()

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
    { uid: firebaseUid }
  )

  if (!profile?.role) return null

  const permIds = profile.role.permission_ids || []
  if (permIds.length === 0) {
    return { ...profile, permissions: [] }
  }

  const perms = await sanity.fetch(
    `*[_type == "permission" && _id in $ids]{ _id, code }`,
    { ids: permIds }
  )
  const permissionCodes = (perms || []).map((p) => p.code).filter(Boolean)

  if (!profile.role_id && profile.role?._id) {
    profile.role_id = profile.role._id
  }

  return {
    ...profile,
    permissions: permissionCodes,
  }
}

/** Stable Sanity _id per Firebase uid so parallel ensure runs cannot create duplicate rows. */
export function userProfileDocumentId(firebaseUid) {
  if (!firebaseUid) return ''
  const safe = String(firebaseUid).replace(/[^a-zA-Z0-9_.-]/g, '-')
  return `userProfile.${safe}`
}

/** First registered Firebase user becomes super_admin; others default guest (inventory view only). */
export async function ensureUserProfileForFirebaseUser(user) {
  if (!sanity || !user?.uid) return null
  await ensureBootstrap()

  const rows = await sanity.fetch(
    `*[_type == "userProfile" && firebase_uid == $uid]{ _id } | order(_createdAt asc)`,
    { uid: user.uid }
  )
  const ids = (rows || []).map((r) => r._id).filter(Boolean)

  if (ids.length > 1) {
    for (let i = 1; i < ids.length; i++) {
      await sanity.delete(ids[i]).catch(() => {})
    }
  }

  let docId = ids[0]

  if (!docId) {
    const profileId = userProfileDocumentId(user.uid)
    const totalProfiles = await sanity.fetch('count(*[_type == "userProfile"])')
    const roleRef =
      totalProfiles === 0
        ? { _type: 'reference', _ref: 'role-super-admin' }
        : { _type: 'reference', _ref: 'role-guest' }

    try {
      await sanity.createIfNotExists({
        _id: profileId,
        _type: 'userProfile',
        firebase_uid: user.uid,
        email: user.email || '',
        display_name: user.displayName || '',
        role: roleRef,
        created_at: new Date().toISOString(),
      })
    } catch {
      /* race/network */
    }
    docId = profileId
  }

  const patch = sanity.patch(docId).set({
    email: user.email || '',
    updated_at: new Date().toISOString(),
  })
  const name = user.displayName?.trim()
  if (name) patch.set({ display_name: name })
  await patch.commit().catch(() => {})

  return docId
}

// --- Vehicles ---

const vehicleProjection = `{
  ...,
  "images": images
}`

/** Minimal fields + first image only — smaller payloads for public / paginated grids. */
const vehiclePublicCardProjection = `{
  _id,
  stock_id, plate_no, brand, model, body, color, location,
  selling_price, reserved, sold, photographed,
  "images": images | order(coalesce(sortOrder, 0) asc)[0..0]{ _key, url, "sort_order": coalesce(sortOrder, 0) }
}`

export async function fetchVehicleById(id) {
  if (!sanity) return null
  const doc = await sanity.fetch(`*[_type == "vehicle" && _id == $id][0] ${vehicleProjection}`, { id })
  return sanityVehicleToApp(doc)
}

export async function fetchVehicleByPickupToken(token) {
  if (!sanity) return null
  const doc = await sanity.fetch(
    `*[_type == "vehicle" && pickup_token == $token && reserved == true && sold == false][0] ${vehicleProjection}`,
    { token }
  )
  return sanityVehicleToApp(doc)
}

export async function fetchVehicleLocations(query) {
  if (!sanity) return []
  const all = await sanity.fetch(`array::unique(*[_type == "vehicle" && defined(location)].location)`)
  const list = (all || []).filter(Boolean).sort()
  const q = (query || '').trim().toLowerCase()
  if (q.length < 2) return list.slice(0, 15)
  return list.filter((loc) => String(loc).toLowerCase().includes(q)).slice(0, 15)
}

function buildVehicleImagesArray(existingImages, imagesToKeepKeys, newUrls) {
  const kept = (existingImages || []).filter((img) => {
    const key = img._key || img.id
    return imagesToKeepKeys.has(key)
  })
  const sortedKept = [...kept].sort(
    (a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0)
  )
  const out = sortedKept.map((img, i) => ({
    _key: img._key || img.id,
    _type: 'vehicleImage',
    url: img.url,
    sortOrder: i,
  }))
  let idx = out.length
  for (const url of newUrls) {
    out.push({
      _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      _type: 'vehicleImage',
      url,
      sortOrder: idx++,
    })
  }
  return out
}

/** Strip undefined; omit images (handled separately) */
function cleanVehiclePayload(payload) {
  const out = {}
  for (const [k, v] of Object.entries(payload)) {
    if (k === 'images' || k === 'id' || k === '_id') continue
    if (v !== undefined) out[k] = v
  }
  return out
}

export async function saveVehicle({ vehicleId, payload, existingDoc, newImageUrls, removedImageKeys }) {
  if (!sanity) throw new Error('Sanity not configured')

  const removed = removedImageKeys instanceof Set ? removedImageKeys : new Set(removedImageKeys || [])
  const keepKeys = new Set()
  for (const img of existingDoc?.images || []) {
    const key = img._key || img.id
    if (!removed.has(key)) keepKeys.add(key)
  }
  const images = buildVehicleImagesArray(existingDoc?.images || [], keepKeys, newImageUrls || [])

  const cleaned = cleanVehiclePayload(payload)

  if (vehicleId) {
    await sanity
      .patch(vehicleId)
      .set({ ...cleaned, images, updated_at: new Date().toISOString() })
      .commit()
    return vehicleId
  }

  const created = await sanity.create({
    _type: 'vehicle',
    ...cleaned,
    images,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  return created._id
}

export async function patchVehicleFields(id, fields) {
  if (!sanity) throw new Error('Sanity not configured')
  await sanity
    .patch(id)
    .set({ ...fields, updated_at: new Date().toISOString() })
    .commit()
}

export async function deleteVehicle(id) {
  if (!sanity) throw new Error('Sanity not configured')
  const wids = await sanity.fetch(
    `*[_type == "reservationWorkflowUpdate" && vehicle_id == $vid]._id`,
    { vid: id }
  )
  for (const wid of wids || []) {
    await sanity.delete(wid)
  }
  await sanity.delete(id)
}

/** @param {object} opts
 *  status: 'available' | 'sold' | 'reserved' | undefined
 *  search, brand, model, maxPrice, sold, reserved (legacy), limit
 */
export function buildVehicleFilter(opts = {}) {
  const clauses = ['_type == "vehicle"']
  const params = {}

  const status = opts.status
  if (status === 'available') {
    clauses.push('sold == false')
    clauses.push('reserved == false')
  } else if (status === 'sold') {
    clauses.push('sold == true')
  } else if (status === 'reserved') {
    clauses.push('reserved == true')
    clauses.push('sold == false')
  } else {
    if (opts.sold !== undefined) {
      clauses.push('sold == $sold')
      params.sold = opts.sold
    }
    if (opts.reserved !== undefined) {
      clauses.push('reserved == $reserved')
      params.reserved = opts.reserved
    }
  }

  const mp = opts.maxPrice != null && opts.maxPrice !== '' ? Number(opts.maxPrice) : null
  if (mp != null && !isNaN(mp) && mp > 0) {
    clauses.push('(!defined(selling_price) || selling_price <= $maxPrice)')
    params.maxPrice = mp
  }

  if (opts.brand) {
    clauses.push('brand == $brand')
    params.brand = opts.brand
  }
  if (opts.model) {
    clauses.push('model == $model')
    params.model = opts.model
  }
  if (opts.search?.trim()) {
    clauses.push(
      '(stock_id match $spat || plate_no match $spat || brand match $spat || model match $spat || (defined(location) && location match $spat))'
    )
    params.spat = `*${opts.search.trim()}*`
  }

  return { filter: clauses.join(' && '), params }
}

export async function fetchVehiclesForList(opts = {}) {
  if (!sanity) return []
  const lim = Math.min(Number(opts.limit) || 500, 2000)
  const { filter, params } = buildVehicleFilter(opts)
  const q = `*[${filter}] | order(_createdAt desc) [0...${lim}] ${vehicleProjection}`
  const docs = await sanity.fetch(q, params)
  return (docs || []).map(sanityVehicleToApp)
}

/**
 * @param {object} filters
 * @param {number} offset
 * @param {number} pageSize
 * @param {{ includeTotal?: boolean, lightProjection?: boolean }} [options] — skip count on page 2+ for faster pagination; use lightProjection on public list.
 */
export async function fetchVehiclesPage(filters, offset, pageSize, options = {}) {
  const includeTotal = options.includeTotal !== false
  if (!sanity) return { items: [], total: includeTotal ? 0 : undefined }
  const lightProjection = options.lightProjection === true
  const proj = lightProjection ? vehiclePublicCardProjection : vehicleProjection
  const { filter, params } = buildVehicleFilter(filters)
  let total
  if (includeTotal) {
    total = await sanity.fetch(`count(*[${filter}])`, params)
  }
  const end = offset + pageSize
  const docs = await sanity.fetch(
    `*[${filter}] | order(_createdAt desc) [${offset}...${end}] ${proj}`,
    params
  )
  return { items: (docs || []).map(sanityVehicleToApp), total }
}

export async function fetchVehiclesForModelCounts(filters) {
  if (!sanity) return {}
  const { filter, params } = buildVehicleFilter(filters)
  const rows = await sanity.fetch(
    `*[${filter}]{ brand, model }[0...1999]`,
    params
  )
  const counts = {}
  for (const v of rows || []) {
    const key = `${(v.brand || '').trim()}|${(v.model || '').trim()}`
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

export async function fetchAllVehiclesFiltered(filters) {
  if (!sanity) return []
  const { filter, params } = buildVehicleFilter(filters)
  const docs = await sanity.fetch(
    `*[${filter}] | order(_createdAt desc) [0...4999] ${vehicleProjection}`,
    params
  )
  return (docs || []).map(sanityVehicleToApp)
}

export async function fetchVehiclesByPlateOrStock(q) {
  if (!sanity) return []
  const qt = (q || '').trim()
  if (!qt) return []
  const pat = `*${qt}*`
  const docs = await sanity.fetch(
    `*[ _type == "vehicle" && (plate_no match $p || stock_id match $p)][0...5] ${vehicleProjection}`,
    { p: pat }
  )
  return (docs || []).map(sanityVehicleToApp)
}

export async function fetchSimilarVehiclesPool(excludeId) {
  if (!sanity) return []
  const docs = await sanity.fetch(
    `*[_type == "vehicle" && sold == false && reserved == false && _id != $ex][0...100] ${vehicleProjection}`,
    { ex: excludeId }
  )
  return (docs || []).map(sanityVehicleToApp)
}

export async function vehicleCounts() {
  if (!sanity) return { available: 0, reserved: 0, sold: 0 }
  const [available, reserved, sold] = await Promise.all([
    sanity.fetch('count(*[_type == "vehicle" && sold == false && reserved == false])'),
    sanity.fetch('count(*[_type == "vehicle" && reserved == true && sold == false])'),
    sanity.fetch('count(*[_type == "vehicle" && sold == true])'),
  ])
  return { available, reserved, sold }
}

export async function fetchRecentSold(limit = 10) {
  if (!sanity) return []
  const lim = Math.min(Math.max(1, Number(limit) || 10), 50)
  const docs = await sanity.fetch(
    `*[_type == "vehicle" && sold == true] | order(_createdAt desc) [0...${lim}] ${vehicleProjection}`
  )
  return (docs || []).map(sanityVehicleToApp)
}

export async function fetchBrandsAndModels() {
  if (!sanity) return { brands: [], modelsByBrand: {} }
  const rows = await sanity.fetch(
    `*[_type == "vehicle" && defined(brand)]{ brand, model }`
  )
  const brands = [...new Set((rows || []).map((r) => r.brand).filter(Boolean))].sort()
  const modelsByBrand = {}
  for (const r of rows || []) {
    if (!r.brand || !r.model) continue
    if (!modelsByBrand[r.brand]) modelsByBrand[r.brand] = new Set()
    modelsByBrand[r.brand].add(r.model)
  }
  for (const b of Object.keys(modelsByBrand)) {
    modelsByBrand[b] = [...modelsByBrand[b]].sort()
  }
  return { brands, modelsByBrand }
}

// --- Workflow ---

export async function fetchWorkflowUpdates(vehicleId) {
  if (!sanity) return []
  return sanity.fetch(
    `*[_type == "reservationWorkflowUpdate" && vehicle_id == $vid] | order(updated_at desc) {
      ...,
      "id": _id
    }`,
    { vid: vehicleId }
  )
}

export async function insertWorkflowUpdate(row) {
  if (!sanity) throw new Error('Sanity not configured')
  await sanity.create({
    _type: 'reservationWorkflowUpdate',
    ...row,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteWorkflowUpdate(id) {
  if (!sanity) throw new Error('Sanity not configured')
  await sanity.delete(id)
}

// --- Work paths (multi-step prep pipelines on vehicles) ---

function newWorkPathStepKey() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function randomWorkflowInstanceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

function normalizeWorkPathApplyWhen(raw) {
  if (raw === 'reserved_only' || raw === 'available_listed_only') return raw
  return 'always'
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
}`

/** Dropdown list only — always works even if step projections fail elsewhere. */
export async function fetchWorkPathTemplatesList() {
  if (!sanity) return []
  await ensureBootstrap()
  return sanity.fetch(
    `*[_type == "workPath"] | order(name asc) { _id, "id": _id, name, description, apply_when, allow_step_overlap }`
  )
}

export async function fetchAllWorkPaths() {
  if (!sanity) return []
  await ensureBootstrap()
  return sanity.fetch(`*[_type == "workPath"] | order(name asc) ${workPathFullProjection}`)
}

export async function fetchWorkPathById(id) {
  if (!sanity) return null
  await ensureBootstrap()
  return sanity.fetch(`*[_type == "workPath" && _id == $id][0] ${workPathFullProjection}`, { id })
}

/** @param {{ name: string, description?: string, steps: { title: string, role_id: string, assignee_profile_id: string }[] }} body */
export async function createWorkPath(body) {
  if (!sanity) throw new Error('Sanity not configured')
  const { name, description = '', steps = [], apply_when, allow_step_overlap } = body
  if (!name?.trim()) throw new Error('Work path name is required')
  if (!steps.length) throw new Error('Add at least one step')
  const docSteps = []
  for (const s of steps) {
    if (!s.title?.trim()) throw new Error('Each step needs a title')
    if (!s.role_id) throw new Error('Each step needs a role')
    if (!s.assignee_profile_id) throw new Error('Each step needs an assignee')
    docSteps.push({
      _key: newWorkPathStepKey(),
      title: s.title.trim(),
      role: { _type: 'reference', _ref: s.role_id },
      assignee: { _type: 'reference', _ref: s.assignee_profile_id },
    })
  }
  const created = await sanity.create({
    _type: 'workPath',
    name: name.trim(),
    description: (description || '').trim(),
    apply_when: normalizeWorkPathApplyWhen(apply_when),
    allow_step_overlap: !!allow_step_overlap,
    steps: docSteps,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  return created._id
}

export async function updateWorkPath(id, body) {
  if (!sanity) throw new Error('Sanity not configured')
  const { name, description = '', steps = [], apply_when, allow_step_overlap } = body
  if (!name?.trim()) throw new Error('Work path name is required')
  if (!steps.length) throw new Error('Add at least one step')
  const docSteps = []
  for (const s of steps) {
    if (!s.title?.trim()) throw new Error('Each step needs a title')
    if (!s.role_id) throw new Error('Each step needs a role')
    if (!s.assignee_profile_id) throw new Error('Each step needs an assignee')
    docSteps.push({
      _key: s._key || newWorkPathStepKey(),
      title: s.title.trim(),
      role: { _type: 'reference', _ref: s.role_id },
      assignee: { _type: 'reference', _ref: s.assignee_profile_id },
    })
  }
  await sanity
    .patch(id)
    .set({
      name: name.trim(),
      description: (description || '').trim(),
      apply_when: normalizeWorkPathApplyWhen(apply_when),
      allow_step_overlap: !!allow_step_overlap,
      steps: docSteps,
      updated_at: new Date().toISOString(),
    })
    .commit()
}

export async function deleteWorkPath(id) {
  if (!sanity) throw new Error('Sanity not configured')
  await sanity.delete(id)
}

function stableLegacyInstanceId(w) {
  if (w.instance_id) return w.instance_id
  const raw = `${w.template_id || ''}|${w.started_at || ''}|${w.template_name || ''}|${(w.steps || []).length}`
  let h = 0
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0
  return `legacy-${Math.abs(h).toString(36)}`
}

function migrateLegacyWorkflowInstance(w) {
  if (!w) return null
  const base = {
    ...w,
    instance_id: stableLegacyInstanceId(w),
    priority: w.priority === 'urgent' ? 'urgent' : 'normal',
    sort_order: Number(w.sort_order) || 0,
    deadline_at: w.deadline_at || null,
    discussion: Array.isArray(w.discussion) ? w.discussion : [],
    current_step_started_at: w.current_step_started_at || w.started_at || null,
    completed_steps: Array.isArray(w.completed_steps) ? w.completed_steps : [],
    time_sessions: Array.isArray(w.time_sessions) ? w.time_sessions : [],
    apply_when: w.apply_when || 'always',
    allow_step_overlap: w.allow_step_overlap === true,
  }
  return base
}

function closeOpenTimeSessionsForUser(inst, userUid, endedAtIso) {
  if (!userUid) return inst.time_sessions || []
  return (inst.time_sessions || []).map((s) =>
    s.user_uid === userUid && !s.ended_at ? { ...s, ended_at: endedAtIso } : s
  )
}

/** @param {Record<string, unknown>|null|undefined} vehicle */
export function normalizeVehicleWorkflowInstances(vehicle) {
  if (!vehicle) return []
  if (Array.isArray(vehicle.ops_workflows) && vehicle.ops_workflows.length) {
    return vehicle.ops_workflows.map(migrateLegacyWorkflowInstance).filter(Boolean)
  }
  if (vehicle.ops_workflow) {
    const one = migrateLegacyWorkflowInstance(vehicle.ops_workflow)
    return one ? [one] : []
  }
  return []
}

export function workflowInstanceStepKey(steps, index) {
  const s = steps[index]
  return s?._key || `step-${index}`
}

function completedStepKeysSet(inst) {
  const m = new Set()
  for (const c of inst.completed_steps || []) {
    if (c.step_key) m.add(c.step_key)
  }
  return m
}

export function collectMyWorkItems(vehicles, firebaseUid) {
  const out = []
  for (const vehicle of vehicles || []) {
    const instances = normalizeVehicleWorkflowInstances(vehicle)
    for (const inst of instances) {
      if (inst.status !== 'active') continue
      const steps = inst.steps || []
      const parallel = inst.allow_step_overlap === true
      if (parallel) {
        const done = completedStepKeysSet(inst)
        steps.forEach((step, stepIndex) => {
          const sk = workflowInstanceStepKey(steps, stepIndex)
          if (done.has(sk)) return
          if (step.assignee_uid === firebaseUid) {
            out.push({ vehicle, instance: inst, currentStep: step, stepIndex })
          }
        })
      } else {
        const idx = Number(inst.current_step_index) || 0
        const cur = steps[idx]
        if (cur?.assignee_uid === firebaseUid) {
          out.push({ vehicle, instance: inst, currentStep: cur, stepIndex: idx })
        }
      }
    }
  }
  out.sort((a, b) => {
    const pri = (x) => (x.instance.priority === 'urgent' ? 0 : 1)
    let c = pri(a) - pri(b)
    if (c !== 0) return c
    const da = a.instance.deadline_at ? new Date(a.instance.deadline_at).getTime() : Infinity
    const db = b.instance.deadline_at ? new Date(b.instance.deadline_at).getTime() : Infinity
    c = da - db
    if (c !== 0) return c
    return (Number(a.instance.sort_order) || 0) - (Number(b.instance.sort_order) || 0)
  })
  return out
}

export function getWorkflowDeadlineVisual(instance) {
  if (!instance) return { tone: 'none', label: null }
  if (instance.priority === 'urgent') return { tone: 'urgent', label: 'Urgent' }
  if (!instance.deadline_at) return { tone: 'none', label: null }
  const d = new Date(instance.deadline_at).getTime()
  const now = Date.now()
  if (d < now) return { tone: 'overdue', label: 'Overdue' }
  if (d - now < 24 * 60 * 60 * 1000) return { tone: 'due_soon', label: 'Due soon' }
  return { tone: 'deadline', label: 'Has deadline' }
}

function buildStepsSnapshotFromTemplate(template) {
  const stepsSnapshot = []
  for (const s of template.steps || []) {
    const assignee = s.assignee
    if (!assignee?.firebase_uid) throw new Error(`Step "${s.title}" has no valid assignee`)
    const roleId = s.role_id || s.role?._id
    const assigneeRole = assignee.assignee_role_id
    const assigneeRoleName = assignee.assignee_role?.name
    const superOk = assigneeRoleName === 'super_admin'
    if (roleId && assigneeRole && assigneeRole !== roleId && !superOk) {
      throw new Error(`Assignee for "${s.title}" does not have the selected role`)
    }
    stepsSnapshot.push({
      _key: s._key || newWorkPathStepKey(),
      title: s.title,
      role_id: roleId,
      role_name: s.role?.name || '',
      assignee_uid: assignee.firebase_uid,
      assignee_name: assignee.display_name || assignee.email || assignee.firebase_uid,
      assignee_profile_id: assignee._id || s.assignee_id,
    })
  }
  return stepsSnapshot
}

/**
 * @param {string} vehicleId
 * @param {string} templateId
 * @param {{ deadlineAt?: string|null, priority?: 'normal'|'urgent' }} [options]
 */
export async function applyWorkPathToVehicle(vehicleId, templateId, options = {}) {
  if (!sanity) throw new Error('Sanity not configured')
  const template = await fetchWorkPathById(templateId)
  if (!template?.steps?.length) throw new Error('Work path not found or has no steps')

  const stepsSnapshot = buildStepsSnapshotFromTemplate(template)
  const now = new Date().toISOString()
  const deadlineAt = options.deadlineAt && String(options.deadlineAt).trim() ? String(options.deadlineAt).trim() : null
  const priority = options.priority === 'urgent' ? 'urgent' : 'normal'

  const v = await sanity.fetch(
    `*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows, sold, reserved }`,
    {
      id: vehicleId,
    }
  )

  const gate = normalizeWorkPathApplyWhen(template.apply_when)
  const allow = vehicleMeetsApplyWhen({ sold: v?.sold, reserved: v?.reserved }, gate)
  if (!allow.ok) throw new Error(allow.message)

  let list = []
  if (v?.ops_workflows?.length) {
    list = v.ops_workflows.map(migrateLegacyWorkflowInstance).filter(Boolean)
  } else if (v?.ops_workflow) {
    const one = migrateLegacyWorkflowInstance(v.ops_workflow)
    if (one) list = [one]
  }

  if (list.length > 0) {
    throw new Error('This vehicle already has a work path. Remove it before assigning another.')
  }

  const maxSort = list.reduce((m, x) => Math.max(m, Number(x.sort_order) || 0), 0)
  const newInst = {
    instance_id: randomWorkflowInstanceId(),
    template_id: templateId,
    template_name: template.name || 'Work path',
    current_step_index: 0,
    status: 'active',
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
  }
  list.push(newInst)

  const patch = sanity.patch(vehicleId).set({ ops_workflows: list, updated_at: now })
  if (v?.ops_workflow) patch.unset(['ops_workflow'])
  await patch.commit()
}

export async function removeVehicleWorkPathInstance(vehicleId, instanceId) {
  if (!sanity) throw new Error('Sanity not configured')
  const v = await sanity.fetch(`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`, {
    id: vehicleId,
  })
  let list = normalizeVehicleWorkflowInstances(v)
  list = list.filter((x) => x.instance_id !== instanceId)
  const t = new Date().toISOString()
  if (!list.length) {
    await sanity.patch(vehicleId).unset(['ops_workflows']).commit()
    await sanity.patch(vehicleId).unset(['ops_workflow']).commit()
    await sanity.patch(vehicleId).set({ updated_at: t }).commit()
    return
  }
  const patch = sanity.patch(vehicleId).set({ ops_workflows: list, updated_at: t })
  if (v?.ops_workflow) patch.unset(['ops_workflow'])
  await patch.commit()
}

/** @deprecated use removeVehicleWorkPathInstance; clears legacy single workflow only */
export async function clearVehicleWorkPath(vehicleId) {
  if (!sanity) throw new Error('Sanity not configured')
  const t = new Date().toISOString()
  await sanity.patch(vehicleId).unset(['ops_workflows']).commit()
  await sanity.patch(vehicleId).unset(['ops_workflow']).commit()
  await sanity.patch(vehicleId).set({ updated_at: t }).commit()
}

/**
 * @param {string} vehicleId
 * @param {string|null} instanceId — null = legacy single workflow
 * @param {string} firebaseUid
 * @param {{ override?: boolean, step_key?: string }} opts — `step_key` required when instance has `allow_step_overlap`
 */
export async function completeVehicleWorkPathStep(vehicleId, instanceId, firebaseUid, opts = {}) {
  if (!sanity) throw new Error('Sanity not configured')
  const override = !!opts.override
  const requestedStepKey = opts.step_key != null && String(opts.step_key).trim() !== '' ? String(opts.step_key) : null
  const v = await sanity.fetch(`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`, {
    id: vehicleId,
  })
  let list = normalizeVehicleWorkflowInstances(v)
  if (!list.length) throw new Error('No work path on this vehicle')

  let wi = instanceId ? list.findIndex((x) => x.instance_id === instanceId) : -1
  if (wi < 0) wi = list.findIndex((x) => x.status === 'active')
  if (wi < 0) wi = list.length === 1 ? 0 : -1
  if (wi < 0) throw new Error('Work path instance not found')

  const w = list[wi]
  if (!w || w.status !== 'active') throw new Error('No active work path')
  if (w.deadline_at && new Date(w.deadline_at).getTime() < Date.now()) {
    throw new Error('This work path is past its deadline')
  }

  const steps = w.steps || []
  if (!steps.length) throw new Error('Invalid work path')
  const parallel = w.allow_step_overlap === true

  let idx
  if (parallel) {
    if (!requestedStepKey) throw new Error('Step is required for parallel (overlap) work paths')
    idx = steps.findIndex((s, i) => workflowInstanceStepKey(steps, i) === requestedStepKey)
    if (idx < 0) throw new Error('Step not found')
  } else {
    idx = Number(w.current_step_index) || 0
    if (idx >= steps.length) throw new Error('Work path already finished')
    if (requestedStepKey) {
      const expect = workflowInstanceStepKey(steps, idx)
      if (requestedStepKey !== expect) throw new Error('Out of sequence — complete the current step first')
    }
  }

  const step = steps[idx]
  if (!step) throw new Error('Invalid step')
  if (!override && step.assignee_uid !== firebaseUid) {
    throw new Error('Only the assigned person can complete this step')
  }

  const stepKey = workflowInstanceStepKey(steps, idx)
  const doneKeys = new Set((w.completed_steps || []).map((c) => c.step_key))
  if (doneKeys.has(stepKey)) throw new Error('This step is already completed')

  const now = new Date().toISOString()
  const stepStarted = parallel
    ? w.started_at || now
    : w.current_step_started_at || w.started_at || now

  const completed = [
    ...(w.completed_steps || []),
    {
      step_key: stepKey,
      started_at: stepStarted,
      completed_at: now,
      completed_by_uid: firebaseUid,
    },
  ]

  const doneSet = new Set(completed.map((c) => c.step_key))
  const allDone = steps.every((s, i) => doneSet.has(workflowInstanceStepKey(steps, i)))
  let nextIdx
  if (allDone) {
    nextIdx = steps.length
  } else {
    nextIdx = steps.findIndex((s, i) => !doneSet.has(workflowInstanceStepKey(steps, i)))
    if (nextIdx < 0) nextIdx = steps.length
  }

  const nextInst = {
    ...w,
    time_sessions: closeOpenTimeSessionsForUser(w, firebaseUid, now),
    completed_steps: completed,
    current_step_index: nextIdx,
    status: allDone ? 'done' : 'active',
    current_step_started_at: allDone ? null : parallel ? null : now,
    ...(allDone ? { finished_at: now } : {}),
  }
  list[wi] = nextInst

  const patch = sanity.patch(vehicleId).set({ ops_workflows: list, updated_at: now })
  if (v?.ops_workflow) patch.unset(['ops_workflow'])
  await patch.commit()
}

export async function startWorkPathTimeSession(vehicleId, instanceId, payload) {
  if (!sanity) throw new Error('Sanity not configured')
  const userUid = payload?.user_uid
  const user_display_name = (payload?.user_display_name || '').trim() || null
  const payloadStepKey = payload?.step_key != null && String(payload.step_key).trim() !== '' ? String(payload.step_key) : null
  if (!userUid) throw new Error('Not signed in')

  const v = await sanity.fetch(`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`, {
    id: vehicleId,
  })
  let list = normalizeVehicleWorkflowInstances(v)
  const wi = list.findIndex((x) => x.instance_id === instanceId)
  if (wi < 0) throw new Error('Work path instance not found')

  const inst = { ...list[wi] }
  if (inst.status !== 'active') throw new Error('Work path is not active')
  if (inst.deadline_at && new Date(inst.deadline_at).getTime() < Date.now()) {
    throw new Error('This work path is past its deadline')
  }

  const steps = inst.steps || []
  const parallel = inst.allow_step_overlap === true
  let idx
  let cur
  if (parallel) {
    if (!payloadStepKey) throw new Error('Step is required to start work on parallel paths')
    idx = steps.findIndex((s, i) => workflowInstanceStepKey(steps, i) === payloadStepKey)
    if (idx < 0) throw new Error('Step not found')
    cur = steps[idx]
    const done = completedStepKeysSet(inst)
    if (done.has(payloadStepKey)) throw new Error('This step is already completed')
  } else {
    idx = Number(inst.current_step_index) || 0
    cur = steps[idx]
    if (payloadStepKey) {
      const expect = workflowInstanceStepKey(steps, idx)
      if (payloadStepKey !== expect) throw new Error('Only the current step can be started')
    }
  }
  if (!cur || cur.assignee_uid !== userUid) {
    throw new Error('Only the assignee for this step can start time tracking')
  }

  const sessions = [...(inst.time_sessions || [])]
  const targetKey = workflowInstanceStepKey(steps, idx)
  if (sessions.some((s) => s.user_uid === userUid && !s.ended_at)) {
    throw new Error('Finish your in-progress step before starting another timer')
  }

  const now = new Date().toISOString()
  sessions.push({
    _key: randomWorkflowInstanceId().replace(/-/g, '').slice(0, 12),
    step_key: targetKey,
    step_title: cur.title || '',
    user_uid: userUid,
    user_display_name,
    started_at: now,
    ended_at: null,
  })
  inst.time_sessions = sessions
  list[wi] = inst

  const patch = sanity.patch(vehicleId).set({ ops_workflows: list, updated_at: now })
  if (v?.ops_workflow) patch.unset(['ops_workflow'])
  await patch.commit()
}

export async function endWorkPathTimeSession(vehicleId, instanceId, userUid, stepKey = null) {
  if (!sanity) throw new Error('Sanity not configured')
  if (!userUid) throw new Error('Not signed in')

  const v = await sanity.fetch(`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`, {
    id: vehicleId,
  })
  let list = normalizeVehicleWorkflowInstances(v)
  const wi = list.findIndex((x) => x.instance_id === instanceId)
  if (wi < 0) throw new Error('Work path instance not found')

  const inst = { ...list[wi] }
  const now = new Date().toISOString()
  const sessions = [...(inst.time_sessions || [])]
  const sk = stepKey != null && String(stepKey).trim() !== '' ? String(stepKey) : null
  const openIdx = [...sessions.entries()]
    .filter(
      ([, s]) =>
        s.user_uid === userUid &&
        !s.ended_at &&
        (sk == null || s.step_key === sk)
    )
    .sort(
      (a, b) =>
        new Date(b[1].started_at || 0).getTime() - new Date(a[1].started_at || 0).getTime()
    )[0]?.[0]
  if (openIdx === undefined) throw new Error('No active timer to end')
  sessions[openIdx] = { ...sessions[openIdx], ended_at: now }

  inst.time_sessions = sessions
  list[wi] = inst

  const patch = sanity.patch(vehicleId).set({ ops_workflows: list, updated_at: now })
  if (v?.ops_workflow) patch.unset(['ops_workflow'])
  await patch.commit()
}

export async function addWorkPathDiscussionMessage(vehicleId, instanceId, payload) {
  if (!sanity) throw new Error('Sanity not configured')
  const { author_uid, author_name, body, parent_key, visibility, target_uid, target_name } = payload
  if (!body?.trim()) throw new Error('Message is required')
  const v = await sanity.fetch(`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`, {
    id: vehicleId,
  })
  let list = normalizeVehicleWorkflowInstances(v)
  const wi = list.findIndex((x) => x.instance_id === instanceId)
  if (wi < 0) throw new Error('Work path instance not found')
  const inst = { ...list[wi] }
  const isDirect = visibility === 'direct' && String(target_uid || '').trim() !== ''
  const msg = {
    _key: randomWorkflowInstanceId().replace(/-/g, '').slice(0, 12),
    author_uid: author_uid || '',
    author_name: author_name || '',
    body: body.trim(),
    created_at: new Date().toISOString(),
    parent_key: parent_key || null,
    visibility: isDirect ? 'direct' : 'all',
    target_uid: isDirect ? String(target_uid) : null,
    target_name: isDirect ? String(target_name || '') || null : null,
  }
  inst.discussion = [...(inst.discussion || []), msg]
  list[wi] = inst
  const patch = sanity.patch(vehicleId).set({ ops_workflows: list, updated_at: new Date().toISOString() })
  if (v?.ops_workflow) patch.unset(['ops_workflow'])
  await patch.commit()
}

export async function reorderVehicleWorkflowInstances(vehicleId, orderedInstanceIds) {
  if (!sanity) throw new Error('Sanity not configured')
  if (!Array.isArray(orderedInstanceIds) || !orderedInstanceIds.length) return
  const v = await sanity.fetch(`*[_type == "vehicle" && _id == $id][0]{ ops_workflow, ops_workflows }`, {
    id: vehicleId,
  })
  const list = normalizeVehicleWorkflowInstances(v)
  const map = new Map(list.map((x) => [x.instance_id, { ...x }]))
  const reordered = []
  orderedInstanceIds.forEach((id, i) => {
    const item = map.get(id)
    if (item) {
      item.sort_order = i
      reordered.push(item)
      map.delete(id)
    }
  })
  for (const [, rest] of map) reordered.push(rest)
  reordered.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
  const patch = sanity.patch(vehicleId).set({ ops_workflows: reordered, updated_at: new Date().toISOString() })
  if (v?.ops_workflow) patch.unset(['ops_workflow'])
  await patch.commit()
}

export async function fetchVehiclesWithWorkflows() {
  if (!sanity) return []
  const docs = await sanity.fetch(
    `*[_type == "vehicle" && (defined(ops_workflows) || defined(ops_workflow)) && sold != true] ${vehicleProjection}`
  )
  return (docs || []).map(sanityVehicleToApp)
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
}`

/** Rows for ops analytics (time tracking, path coverage). */
export async function fetchVehiclesWithWorkPathAnalytics(limit = 500) {
  if (!sanity) return []
  const lim = Math.min(Math.max(1, Number(limit) || 500), 1000)
  return sanity.fetch(
    `*[_type == "vehicle" && (defined(ops_workflows) || defined(ops_workflow))] | order(_updatedAt desc) [0...${lim}] ${analyticsWorkflowProjection}`
  )
}

/** Sold rows for timeline charts (_updatedAt ≈ when marked sold in CMS). */
export async function fetchSoldVehiclesAnalyticsTimeline(limit = 400) {
  if (!sanity) return []
  const lim = Math.min(Math.max(1, Number(limit) || 400), 1000)
  return sanity.fetch(
    `*[_type == "vehicle" && sold == true] | order(_updatedAt desc) [0...${lim}] {
      _id,
      brand,
      model,
      _updatedAt
    }`
  )
}

// --- Users / Roles (admin) ---

export async function fetchAllUserProfiles() {
  if (!sanity) return []
  await ensureBootstrap()
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
    }`
  )
  const seen = new Set()
  const deduped = []
  for (const row of rows || []) {
    const k = row.firebase_uid || row.user_id
    if (!k || seen.has(k)) continue
    seen.add(k)
    deduped.push(row)
  }
  deduped.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return deduped
}

export async function fetchAllRoles() {
  if (!sanity) return []
  await ensureBootstrap()
  return sanity.fetch(`*[_type == "role"] | order(name) {
    "id": _id,
    name,
    description,
    is_system,
    permission_ids
  }`)
}

export async function fetchAllPermissions() {
  if (!sanity) return []
  await ensureBootstrap()
  return sanity.fetch(`*[_type == "permission"] | order(category asc, sort_order asc) {
    "id": _id,
    code,
    label,
    category,
    sort_order
  }`)
}

export async function createUserProfileDoc({ firebase_uid, email, display_name, role_id }) {
  if (!sanity) throw new Error('Sanity not configured')
  const existingId = await sanity.fetch(
    `*[_type == "userProfile" && firebase_uid == $uid]{ _id } | order(_createdAt asc)[0]._id`,
    { uid: firebase_uid }
  )
  const _id = existingId || userProfileDocumentId(firebase_uid)

  if (!existingId) {
    await sanity.createIfNotExists({
      _id,
      _type: 'userProfile',
      firebase_uid,
      email: email || '',
      display_name: display_name || '',
      role: { _type: 'reference', _ref: role_id },
      created_at: new Date().toISOString(),
    })
  }

  await sanity
    .patch(_id)
    .set({
      email: email || '',
      display_name: display_name || '',
      role: { _type: 'reference', _ref: role_id },
      updated_at: new Date().toISOString(),
    })
    .commit()
}

export async function updateUserProfileDoc(profileSanityId, { display_name, role_id }) {
  if (!sanity) throw new Error('Sanity not configured')
  const patch = sanity.patch(profileSanityId).set({ updated_at: new Date().toISOString() })
  if (display_name !== undefined) patch.set({ display_name })
  if (role_id) patch.set({ role: { _type: 'reference', _ref: role_id } })
  await patch.commit()
}

export async function deleteUserProfileDoc(profileSanityId) {
  if (!sanity) throw new Error('Sanity not configured')
  await sanity.delete(profileSanityId)
}

export async function updateRolePermissions(roleId, permissionIds) {
  if (!sanity) throw new Error('Sanity not configured')
  await sanity
    .patch(roleId)
    .set({ permission_ids: permissionIds, updated_at: new Date().toISOString() })
    .commit()
}

export async function sanityPing() {
  if (!sanity) return { ok: false, error: 'Not configured' }
  try {
    await sanity.fetch('count(*[_type == "vehicle"])')
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** MOT / delivery notifications */
export async function fetchVehiclesForNotifications() {
  if (!sanity) return []
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
    }`
  )
}

export async function fetchMotVehiclesForNotifications() {
  if (!sanity) return []
  return sanity.fetch(
    `*[_type == "vehicle" && sold == false && defined(mot_expiry_date)]{
      _id,
      stock_id,
      brand,
      model,
      mot_expiry_date
    }`
  )
}

export async function fetchPdiApprovedVehicleIds(reservedIds) {
  if (!sanity || !reservedIds?.length) return new Set()
  const rows = await sanity.fetch(
    `*[_type == "reservationWorkflowUpdate" && step_key == "pdi_approved" && vehicle_id in $ids].vehicle_id`,
    { ids: reservedIds }
  )
  return new Set(rows || [])
}
