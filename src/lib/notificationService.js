import {
  fetchVehiclesForNotifications,
  fetchMotVehiclesForNotifications,
  fetchPdiApprovedVehicleIds,
  fetchVehicleIdsHavingReservationSteps,
  fetchVehiclesWithWorkflows,
  fetchVehiclesWithScheduledViewings,
  fetchVehiclesForViewingStaffAlerts,
  fetchProfileWithPermissions,
  fetchPendingStaffJoinRequests,
  collectMyWorkItems,
  normalizeVehicleWorkflowInstances,
  workflowInstanceStepKey,
} from './sanityData'
import {
  LEGACY_STEPS_AFTER_FULL_SERVICE,
} from './reservationWorkflow'
import { getInstanceDiscussionLastSeen } from './workflowBellState'

function localYmd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Calendar-day difference local (from ≤ to): 0 same day, 1 tomorrow from from. */
function daysBetweenLocalYmd(fromYmd, toYmd) {
  if (!fromYmd || !toYmd) return NaN
  const a = new Date(`${fromYmd}T12:00:00`)
  const b = new Date(`${toYmd}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

/** Normalize Sanity / ISO dates to calendar YYYY-MM-DD (local). */
function coerceToLocalYmd(value) {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (m) return m[1]
  try {
    const dt = new Date(s)
    if (!Number.isNaN(dt.getTime())) return localYmd(dt)
  } catch {
    /* ignore */
  }
  return ''
}

/** Viewings / collections notify up to N calendar days ahead (excluding past). */
const VIEWING_COLLECTION_LOOKAHEAD_DAYS = 2

function localeTimeHm(d) {
  return new Date(d).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export async function fetchAppNotifications() {
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const todayLocal = localYmd()

  const notifications = []

  const reservedVehicles = (await fetchVehiclesForNotifications()).filter(
    (v) => v.reserved && !v.sold,
  )

  const allForMot = await fetchMotVehiclesForNotifications()

  const vehicles = reservedVehicles || []
  const reservedIds = vehicles.map((v) => v._id)

  let pdiApprovedStatus = {}
  /** Vehicles with recorded full-service step or any downstream milestone (incl. legacy skips). */
  let pastFullService = new Set()
  if (reservedIds.length > 0) {
    const approved = await fetchPdiApprovedVehicleIds(reservedIds)
    for (const id of approved) {
      pdiApprovedStatus[id] = true
    }
    pastFullService = await fetchVehicleIdsHavingReservationSteps(
      ['full_service', ...LEGACY_STEPS_AFTER_FULL_SERVICE],
      reservedIds,
    )
  }

  for (const v of vehicles || []) {
    const collectionRaw = v.planned_collection_date
    const pdiDone = pdiApprovedStatus[v._id]
    const collectionYmd = coerceToLocalYmd(collectionRaw)
    if (!collectionYmd) continue

    const deltaColl = daysBetweenLocalYmd(todayLocal, collectionYmd)
    if (
      deltaColl < 0 ||
      deltaColl > VIEWING_COLLECTION_LOOKAHEAD_DAYS
    ) {
      continue
    }

    const vid = v._id
    const fleet = `#${v.stock_id ?? '?'} ${v.brand ?? ''} ${v.model ?? ''}`
      .replace(/\s+/g, ' ')
      .trim()

    if (deltaColl === 0) {
      notifications.push({
        id: `delivery-today-${vid}`,
        vehicleId: vid,
        type: 'delivery_today',
        title: 'Collection today',
        message: `${fleet} — Vehicle collection is scheduled for today.`,
        dueDate: collectionYmd,
        sortAt: `${collectionYmd}T08:00:00`,
        severity: 'high',
      })
    } else if (deltaColl === 1) {
      notifications.push({
        id: `delivery-soon-${vid}-d1`,
        vehicleId: vid,
        type: 'delivery_soon',
        title: 'Collection tomorrow',
        message: `${fleet} — Vehicle collection is scheduled for tomorrow.`,
        dueDate: collectionYmd,
        sortAt: `${collectionYmd}T08:00:00`,
        severity: 'high',
      })
    } else {
      const dateBit = new Date(`${collectionYmd}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      notifications.push({
        id: `delivery-soon-${vid}-d2`,
        vehicleId: vid,
        type: 'delivery_soon',
        title: 'Collection in 2 days',
        message: `${fleet} — Vehicle collection is scheduled in 2 days (${dateBit}).`,
        dueDate: collectionYmd,
        sortAt: `${collectionYmd}T08:00:00`,
        severity: 'medium',
      })
    }

    if (!pastFullService.has(v._id)) {
      const whenBit =
        deltaColl === 0 ? 'today' : deltaColl === 1 ? 'tomorrow' : 'in 2 days'
      notifications.push({
        id: `full-service-due-${vid}`,
        vehicleId: vid,
        type: 'full_service_due',
        title: 'Full service due before collection',
        message: `${fleet} — Record fresh full service in reservation workflow after PDI and before handover (${whenBit}).`,
        dueDate: collectionYmd,
        sortAt: `${collectionYmd}T06:30:00`,
        severity: 'high',
      })
    }

    if (!pdiDone) {
      const whenBit =
        deltaColl === 0 ? 'today' : deltaColl === 1 ? 'tomorrow' : 'in 2 days'
      notifications.push({
        id: `pdi-due-${vid}`,
        vehicleId: vid,
        type: 'pdi_due',
        title: 'PDI due before collection',
        message: `${fleet} — Pre-delivery inspection must be manager-approved before customer collection (${whenBit}).`,
        dueDate: collectionYmd,
        sortAt: `${collectionYmd}T07:00:00`,
        severity: 'high',
      })
    }
  }

  for (const v of allForMot || []) {
    const motExpiry = v.mot_expiry_date
    if (!motExpiry) continue
    const days = Math.ceil((new Date(motExpiry) - new Date()) / (24 * 60 * 60 * 1000))
    if (days <= 0) {
      notifications.push({
        id: `mot-expiry-${v._id}`,
        vehicleId: v._id,
        type: 'mot_expiry',
        title: 'MOT expired',
        message: `#${v.stock_id} ${v.brand} ${v.model} — MOT expired on ${new Date(motExpiry).toLocaleDateString()}`,
        dueDate: motExpiry,
        severity: 'high',
      })
    } else if (motExpiry <= in30Days) {
      notifications.push({
        id: `mot-expiry-${v._id}`,
        vehicleId: v._id,
        type: 'mot_expiry',
        title: `MOT expires in ${days} day${days !== 1 ? 's' : ''}`,
        message: `#${v.stock_id} ${v.brand} ${v.model} — MOT expiry: ${new Date(motExpiry).toLocaleDateString()}`,
        dueDate: motExpiry,
        severity: days <= 7 ? 'high' : 'medium',
      })
    }
  }

  const viewingVehicles = await fetchVehiclesWithScheduledViewings()
  for (const v of viewingVehicles || []) {
    for (const b of v.viewing_bookings || []) {
      const st = b.status || 'scheduled'
      if (st !== 'scheduled') continue
      const at = b.scheduled_at
      if (!at) continue
      const key = b._key
      if (!key) continue

      const bookingYmd = localYmd(new Date(at))
      const deltaBook = daysBetweenLocalYmd(todayLocal, bookingYmd)
      if (deltaBook < 0 || deltaBook > VIEWING_COLLECTION_LOOKAHEAD_DAYS) continue

      const who = (b.customer_name || '').trim() || 'Customer'
      const timeStr = localeTimeHm(at)
      const fleet = `#${v.stock_id ?? '?'} ${v.brand ?? ''} ${v.model ?? ''}`
        .replace(/\s+/g, ' ')
        .trim()

      let title
      let whenPhrase
      if (deltaBook === 0) {
        title = 'Viewing today'
        whenPhrase = `today at ${timeStr}`
      } else if (deltaBook === 1) {
        title = 'Viewing tomorrow'
        whenPhrase = `tomorrow at ${timeStr}`
      } else {
        title = 'Viewing in 2 days'
        const dateBit = new Date(`${bookingYmd}T12:00:00`).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
        whenPhrase = `in 2 days at ${timeStr} (${dateBit})`
      }

      const msgType = deltaBook === 0 ? 'viewing_today' : 'viewing_soon'

      notifications.push({
        id: `${msgType}-${v._id}-${key}`,
        vehicleId: v._id,
        type: msgType,
        title,
        message: `Vehicle viewing — ${fleet} — ${who} booked for ${whenPhrase}.`,
        dueDate: bookingYmd,
        sortAt: at,
        severity: deltaBook === 0 ? 'high' : deltaBook === 1 ? 'high' : 'medium',
      })
    }
  }

  notifications.sort((a, b) => {
    const sa = a.sortAt || `${a.dueDate || ''}T00:00`
    const sb = b.sortAt || `${b.dueDate || ''}T00:00`
    return String(sa).localeCompare(String(sb))
  })
  return notifications
}

function discussionByKey(discussion) {
  const m = new Map()
  for (const x of discussion || []) m.set(x._key, x)
  return m
}

/** Whether a discussion line should notify `uid` (everyone on path vs direct / thread participants). */
function discussionMessageNotifiesUser(msg, byKey, inst, uid) {
  if (!msg || !uid || msg.author_uid === uid) return false

  let root = msg
  const chain = new Set()
  while (root?.parent_key && !chain.has(root._key)) {
    chain.add(root._key)
    const parent = byKey.get(root.parent_key)
    if (!parent) break
    root = parent
  }

  const directRoot = root.visibility === 'direct' || !!root.target_uid
  if (directRoot) {
    const t = root.target_uid
    const a = root.author_uid
    return uid === t || uid === a
  }

  const steps = inst.steps || []
  const participants = new Set(steps.map((s) => s.assignee_uid).filter(Boolean))
  return participants.has(uid)
}

/**
 * Work-path rows: active assignments + unseen discussion (since last panel open for that instance).
 * @param {string} firebaseUid
 * @param {unknown[]} vehiclesApp - app vehicles from fetchVehiclesWithWorkflows
 */
export function buildWorkflowNotificationItems(firebaseUid, vehiclesApp) {
  if (!firebaseUid || !vehiclesApp?.length) return []

  const items = []
  const workRows = collectMyWorkItems(vehiclesApp, firebaseUid)
  for (const { vehicle, instance, currentStep } of workRows) {
    const vid = vehicle.id
    const iid = instance.instance_id
    items.push({
      id: `work-assign-${vid}-${iid}`,
      vehicleId: vid,
      instanceId: iid,
      type: 'work_assigned',
      title: 'Your step on a prep path',
      message: `${instance.template_name}: ${currentStep?.title || 'Step'} — ${vehicle.brand} ${vehicle.model}${
        vehicle.stock_id != null && vehicle.stock_id !== '' ? ` (#${vehicle.stock_id})` : ''
      }`,
      dueDate: instance.deadline_at || null,
      sortAt: instance.deadline_at || instance.started_at || new Date().toISOString(),
      severity: instance.priority === 'urgent' ? 'high' : 'medium',
    })
  }

  for (const vehicle of vehiclesApp) {
    const vid = vehicle.id
    if (!vid) continue
    for (const inst of normalizeVehicleWorkflowInstances(vehicle)) {
      const iid = inst.instance_id
      if (!iid) continue
      const lastSeen = getInstanceDiscussionLastSeen(vid, iid)
      const byKey = discussionByKey(inst.discussion)
      for (const msg of inst.discussion || []) {
        if (!msg?.created_at || !msg.body) continue
        if (lastSeen && String(msg.created_at) <= String(lastSeen)) continue
        if (!discussionMessageNotifiesUser(msg, byKey, inst, firebaseUid)) continue
        const preview =
          msg.body.length > 140 ? `${msg.body.slice(0, 137).trim()}…` : msg.body
        let root = msg
        const seenUp = new Set()
        while (root?.parent_key && byKey.has(root.parent_key) && !seenUp.has(root._key)) {
          seenUp.add(root._key)
          root = byKey.get(root.parent_key)
        }
        const isDirect = root.visibility === 'direct' || !!root.target_uid
        items.push({
          id: `work-comment-${vid}-${iid}-${msg._key}`,
          vehicleId: vid,
          instanceId: iid,
          type: 'work_comment',
          title: isDirect ? 'Direct message on prep path' : 'Comment on prep path',
          message: `${msg.author_name || msg.author_uid || 'Someone'}: ${preview}`,
          dueDate: null,
          sortAt: msg.created_at,
          severity: isDirect ? 'high' : 'medium',
          created_at: msg.created_at,
        })
      }
    }
  }

  return items
}

function userIsManagerTier(permissions) {
  const p = permissions || []
  return p.includes('users:manage') || p.includes('inventory:delete')
}

/** Same cohort as Users page — pending Google staff alerts go to role admins / user managers. */
function canManageUsersForStaffAlerts(profile) {
  if (!profile) return false
  const codes = profile.permissions || []
  const roleName = profile.role?.name
  const superAdmin = String(roleName || '').toLowerCase() === 'super_admin'
  return (
    superAdmin ||
    codes.includes('users:manage') ||
    codes.includes('roles:manage')
  )
}

/** @param {string} uid */
function buildViewingStaffPingNotifications(uid, isManager, vehicles) {
  if (!uid) return []
  const items = []
  const now = Date.now()
  const maxAge = 21 * 24 * 60 * 60 * 1000
  for (const v of vehicles || []) {
    for (const b of v.viewing_bookings || []) {
      const key = b._key
      if (!key) continue
      const cleared = new Set(b.staff_alert_cleared_uids || [])
      if (cleared.has(uid)) continue
      const created = new Date(b.created_at || 0).getTime()
      if (!created || now - created > maxAge) continue
      if ((b.status || 'scheduled') !== 'scheduled') continue

      const mentions = Array.isArray(b.mentioned_firebase_uids) ? b.mentioned_firebase_uids : []
      const isMentioned = mentions.includes(uid)
      const wantsMgr = b.notify_managers !== false
      const showMgr = wantsMgr && isManager
      if (!showMgr && !isMentioned) continue

      const customer = (b.customer_name || '').trim() || 'Customer'
      const when = b.scheduled_at
        ? new Date(b.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : ''
      const extra = (b.staff_message || '').trim()
      const by = (b.created_by_name || '').trim() || 'Staff'
      const stock = v.stock_id != null && v.stock_id !== '' ? `#${v.stock_id}` : 'Stock'
      const vehicleBit = `${stock} ${v.brand || ''} ${v.model || ''}`.trim()

      let title
      let type
      let severity
      if (showMgr && isMentioned) {
        title = 'Viewing booked — you were mentioned'
        type = 'viewing_team_ping'
        severity = 'high'
      } else if (isMentioned) {
        title = 'You were mentioned on a viewing'
        type = 'viewing_mention'
        severity = 'high'
      } else {
        title = 'New viewing booked'
        type = 'viewing_manager_alert'
        severity = 'medium'
      }

      const msgParts = [`${by} scheduled ${customer} for ${vehicleBit} (${when}).`]
      if (extra) msgParts.push(extra)

      items.push({
        id: `viewing-ping-${v._id}-${key}-${showMgr && isMentioned ? 'both' : showMgr ? 'mgr' : 'men'}`,
        vehicleId: v._id,
        bookingKey: key,
        type,
        title,
        message: msgParts.join(' ').replace(/\s+/g, ' ').trim(),
        dueDate: b.scheduled_at ? String(b.scheduled_at).slice(0, 10) : '',
        sortAt: b.created_at || b.scheduled_at || '',
        severity,
        dismissable: true,
      })
    }
  }
  return items
}

function completedStepKeysSet(inst) {
  const m = new Set()
  for (const c of inst.completed_steps || []) {
    if (c.step_key) m.add(c.step_key)
  }
  return m
}

function findWorkflowInstanceOnVehicle(vehicle, instanceId) {
  if (!vehicle || !instanceId) return null
  return normalizeVehicleWorkflowInstances(vehicle).find((i) => i.instance_id === instanceId) || null
}

/**
 * Marks prep-path notifications as handled when live workflow state says the user no longer owes that step,
 * the path is finished, or (comments) the panel was opened after the message. Operational rows stay "open".
 */
export function enrichNotificationsWithRelevantTaskDone(items, vehiclesApp, firebaseUid) {
  const byVid = new Map((vehiclesApp || []).map((v) => [v.id, v]))
  return items.map((n) => {
    let relevantTaskDone = false
    if (!n.instanceId || !n.vehicleId) {
      return { ...n, relevantTaskDone: false }
    }
    const vehicle = byVid.get(n.vehicleId)
    const inst = findWorkflowInstanceOnVehicle(vehicle, n.instanceId)
    if (!inst) {
      return { ...n, relevantTaskDone: true }
    }
    if (inst.status === 'completed' || inst.status === 'cancelled') {
      return { ...n, relevantTaskDone: true }
    }

    const steps = inst.steps || []
    const done = completedStepKeysSet(inst)
    const parallel = inst.allow_step_overlap === true

    if (n.type === 'work_assigned') {
      if (parallel) {
        const pendingMine = steps.filter((s, i) => {
          if (s.assignee_uid !== firebaseUid) return false
          const sk = workflowInstanceStepKey(steps, i)
          return !done.has(sk)
        })
        relevantTaskDone = pendingMine.length === 0
      } else {
        const idx = Number(inst.current_step_index) || 0
        const cur = steps[idx]
        relevantTaskDone = !cur || cur.assignee_uid !== firebaseUid
      }
    } else if (n.type === 'work_comment') {
      const lastSeen = getInstanceDiscussionLastSeen(n.vehicleId, n.instanceId)
      const at = n.created_at || n.sortAt
      if (lastSeen && at && String(lastSeen) >= String(at)) {
        relevantTaskDone = true
      }
    }

    return { ...n, relevantTaskDone }
  })
}

/** Operational (delivery, MOT, PDI) + prep-path assignments and new discussion lines. */
export async function fetchUnifiedAppNotifications(firebaseUid) {
  const [profile, ops, vehicles, viewingPingVehicles] = await Promise.all([
    fetchProfileWithPermissions(firebaseUid),
    fetchAppNotifications(),
    fetchVehiclesWithWorkflows(),
    fetchVehiclesForViewingStaffAlerts(),
  ])
  const permissions = profile?.permissions || []
  const isManager = userIsManagerTier(permissions)
  const viewingPings = buildViewingStaffPingNotifications(firebaseUid, isManager, viewingPingVehicles || [])
  const work = buildWorkflowNotificationItems(firebaseUid, vehicles || [])
  let staffSignupAlerts = []
  if (canManageUsersForStaffAlerts(profile)) {
    const pendingStaff = await fetchPendingStaffJoinRequests()
    staffSignupAlerts = (pendingStaff || []).map((req) => ({
      id: `staff-signup-${req.id}`,
      type: 'staff_signup_pending',
      title: 'New Google staff sign-up',
      message: `${(req.display_name || '').trim() || req.email || 'Someone'} (${req.email || 'no email'}) is waiting for approval under Users.`,
      sortAt: req.requested_at || '',
      severity: 'high',
      relevantTaskDone: false,
      navigateTo: '/app/users',
    }))
  }
  const merged = [
    ...staffSignupAlerts,
    ...ops.map((n) => ({ ...n, sortAt: n.sortAt || n.dueDate || '' })),
    ...work,
    ...viewingPings,
  ]
  merged.sort((a, b) => String(b.sortAt || '').localeCompare(String(a.sortAt || '')))
  return enrichNotificationsWithRelevantTaskDone(merged, vehicles || [], firebaseUid)
}

/**
 * Same as fetchUnifiedAppNotifications.
 * Items drop off when the underlying task/data no longer applies (e.g. date passed, step done, vehicle sold),
 * not when the user opens a notification.
 */
export async function fetchActiveAppNotifications(firebaseUid) {
  return fetchUnifiedAppNotifications(firebaseUid)
}
