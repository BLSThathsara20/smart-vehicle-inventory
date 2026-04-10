import { normalizeVehicleWorkflowInstances } from './sanityData'
import { sessionDurationMs } from './workflowTime'

function asVehicleRow(raw) {
  if (!raw) return null
  if (raw.id) return raw
  return { ...raw, id: raw._id, ops_workflows: raw.ops_workflows, ops_workflow: raw.ops_workflow }
}

export function aggregateWorkflowTimeByUser(vehicles) {
  const map = new Map()
  for (const raw of vehicles || []) {
    const vehicle = asVehicleRow(raw)
    if (!vehicle) continue
    const instances = normalizeVehicleWorkflowInstances(vehicle)
    for (const inst of instances) {
      for (const s of inst.time_sessions || []) {
        if (!s.user_uid || !s.started_at) continue
        if (!s.ended_at) continue
        const ms = sessionDurationMs(s)
        const uid = s.user_uid
        if (!map.has(uid)) {
          map.set(uid, { uid, totalMs: 0, sessions: 0, label: s.user_display_name || uid })
        }
        const row = map.get(uid)
        row.totalMs += ms
        row.sessions += 1
        if (s.user_display_name) row.label = s.user_display_name
      }
    }
  }
  return [...map.values()].sort((a, b) => b.totalMs - a.totalMs)
}

export function aggregateCompletedSessionsCount(vehicles) {
  let n = 0
  for (const raw of vehicles || []) {
    const vehicle = asVehicleRow(raw)
    if (!vehicle) continue
    for (const inst of normalizeVehicleWorkflowInstances(vehicle)) {
      for (const s of inst.time_sessions || []) {
        if (s.ended_at && s.started_at) n += 1
      }
    }
  }
  return n
}

/** @param {{ _updatedAt?: string }[]} soldDocs */
export function soldCountsByMonth(soldDocs, monthsBack = 12) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1)
  const buckets = new Map()
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, { key, label: d.toLocaleString(undefined, { month: 'short', year: 'numeric' }), count: 0 })
  }
  for (const doc of soldDocs || []) {
    const t = doc._updatedAt ? new Date(doc._updatedAt).getTime() : NaN
    if (Number.isNaN(t)) continue
    const d = new Date(t)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (buckets.has(key)) buckets.get(key).count += 1
  }
  return [...buckets.values()]
}
