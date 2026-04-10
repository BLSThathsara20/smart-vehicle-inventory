import {
  fetchVehiclesForNotifications,
  fetchMotVehiclesForNotifications,
  fetchPdiApprovedVehicleIds,
  fetchVehiclesWithWorkflows,
  collectMyWorkItems,
  normalizeVehicleWorkflowInstances,
} from './sanityData'
import { getInstanceDiscussionLastSeen } from './workflowBellState'
import { filterUndismissedNotifications } from './notificationDismissState'

export async function fetchAppNotifications() {
  const today = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const notifications = []

  const reservedVehicles = (await fetchVehiclesForNotifications()).filter(
    (v) => v.reserved && !v.sold
  )

  const allForMot = await fetchMotVehiclesForNotifications()

  const vehicles = reservedVehicles || []
  const reservedIds = vehicles.map((v) => v._id)

  let pdiApprovedStatus = {}
  if (reservedIds.length > 0) {
    const approved = await fetchPdiApprovedVehicleIds(reservedIds)
    for (const id of approved) {
      pdiApprovedStatus[id] = true
    }
  }

  for (const v of vehicles || []) {
    const collectionDate = v.planned_collection_date
    const motExpiry = v.mot_expiry_date
    const pdiDone = pdiApprovedStatus[v._id]

    if (collectionDate) {
      if (collectionDate === today) {
        notifications.push({
          id: `delivery-today-${v._id}`,
          vehicleId: v._id,
          type: 'delivery_today',
          title: 'Delivery today',
          message: `#${v.stock_id} ${v.brand} ${v.model} — Collection scheduled for today`,
          dueDate: collectionDate,
          severity: 'high',
        })
      } else if (collectionDate > today && collectionDate <= in7Days) {
        const days = Math.ceil((new Date(collectionDate) - new Date()) / (24 * 60 * 60 * 1000))
        notifications.push({
          id: `delivery-soon-${v._id}`,
          vehicleId: v._id,
          type: 'delivery_soon',
          title: `Delivery in ${days} day${days !== 1 ? 's' : ''}`,
          message: `#${v.stock_id} ${v.brand} ${v.model} — Collection on ${new Date(collectionDate).toLocaleDateString()}`,
          dueDate: collectionDate,
          severity: 'medium',
        })
      }

      if (!pdiDone && collectionDate >= today && collectionDate <= in7Days) {
        notifications.push({
          id: `pdi-due-${v._id}`,
          vehicleId: v._id,
          type: 'pdi_due',
          title: 'Pre-delivery inspection due',
          message: `#${v.stock_id} ${v.brand} ${v.model} — PDI must be completed before delivery`,
          dueDate: collectionDate,
          severity: 'high',
        })
      }
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

  notifications.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
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

/** Operational (delivery, MOT, PDI) + prep-path assignments and new discussion lines. */
export async function fetchUnifiedAppNotifications(firebaseUid) {
  const [ops, vehicles] = await Promise.all([fetchAppNotifications(), fetchVehiclesWithWorkflows()])
  const work = buildWorkflowNotificationItems(firebaseUid, vehicles || [])
  const merged = [...ops.map((n) => ({ ...n, sortAt: n.dueDate || '' })), ...work]
  merged.sort((a, b) => String(b.sortAt || '').localeCompare(String(a.sortAt || '')))
  return merged
}

/** Same as fetchUnifiedAppNotifications but excludes items the user dismissed by opening them. */
export async function fetchActiveAppNotifications(firebaseUid) {
  const all = await fetchUnifiedAppNotifications(firebaseUid)
  return filterUndismissedNotifications(all)
}
