/** Lines for UI (one row per condition). */
export function reservationConditionsToLines(vehicle) {
  const r = vehicle?.reservation_conditions
  if (!Array.isArray(r) || r.length === 0) return ['']
  const lines = r.map((x) => (typeof x === 'string' ? x : x?.text || '').trim())
  return lines.some(Boolean) ? lines : ['']
}

/** Sanity payload: array of { _key, text }. */
export function linesToReservationConditions(lines) {
  const out = []
  for (const line of lines || []) {
    const text = String(line).trim()
    if (!text) continue
    out.push({
      _key: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
      text,
    })
  }
  return out
}

export function formatReservationConditionsList(v) {
  if (!Array.isArray(v) || v.length === 0) return 'Not added'
  const parts = v.map((x) => (typeof x === 'string' ? x : x?.text)).filter(Boolean)
  return parts.length ? parts.map((p, i) => `${i + 1}. ${p}`).join(' · ') : 'Not added'
}
