export function formatDurationMs(ms) {
  if (ms == null || Number.isNaN(ms) || ms <= 0) return '0s'
  const sec = Math.floor(ms / 1000)
  const m = Math.floor(sec / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h`
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${sec % 60}s`
  return `${sec}s`
}

export function sessionDurationMs(session, nowMs = Date.now()) {
  if (!session?.started_at) return 0
  const start = new Date(session.started_at).getTime()
  const end = session.ended_at ? new Date(session.ended_at).getTime() : nowMs
  return Math.max(0, end - start)
}

/** Sum of completed session lengths; does not include running session unless includeRunning. */
export function totalTrackedMsForInstance(inst, includeRunning = false, nowMs = Date.now()) {
  let sum = 0
  for (const s of inst.time_sessions || []) {
    if (!s?.started_at) continue
    if (s.ended_at) sum += sessionDurationMs(s, nowMs)
    else if (includeRunning) sum += sessionDurationMs(s, nowMs)
  }
  return sum
}

/** All sessions summed to nowMs (running timers use elapsed so far). */
export function totalTrackedMsAt(inst, nowMs = Date.now()) {
  let sum = 0
  for (const s of inst.time_sessions || []) {
    if (!s?.started_at) continue
    sum += sessionDurationMs(s, nowMs)
  }
  return sum
}

export function findOpenSessionForUser(inst, userUid) {
  if (!userUid) return null
  const open = (inst.time_sessions || []).filter((s) => s.user_uid === userUid && !s.ended_at)
  if (!open.length) return null
  return open.sort(
    (a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime()
  )[0]
}

/** Open timer for this user on a specific step (parallel paths). If stepKey is null, same as findOpenSessionForUser. */
export function findOpenSessionForUserOnStep(inst, userUid, stepKey) {
  if (!userUid) return null
  if (stepKey == null || stepKey === '') return findOpenSessionForUser(inst, userUid)
  const open = (inst.time_sessions || []).filter(
    (s) => s.user_uid === userUid && !s.ended_at && s.step_key === stepKey
  )
  if (!open.length) return null
  return open.sort(
    (a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime()
  )[0]
}
