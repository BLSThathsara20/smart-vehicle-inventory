/**
 * Work path deadline vs vehicle planned collection (pulout) date.
 * Uses local-calendar YYYY-MM-DD comparison so “on the day” of collection is allowed.
 */

/** @param {unknown} value ISO string, date field, or Date */
export function coerceToLocalYmd(value) {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (m) return m[1]
  try {
    const dt = new Date(s)
    if (Number.isNaN(dt.getTime())) return ''
    const y = dt.getFullYear()
    const mo = String(dt.getMonth() + 1).padStart(2, '0')
    const da = String(dt.getDate()).padStart(2, '0')
    return `${y}-${mo}-${da}`
  } catch {
    return ''
  }
}

/**
 * @param {string|null|undefined} deadlineIso Full ISO from datetime-local / server
 * @param {unknown} plannedCollectionDate Vehicle `planned_collection_date`
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateWorkPathDeadlineVsPlannedCollection(deadlineIso, plannedCollectionDate) {
  const collYmd = coerceToLocalYmd(plannedCollectionDate)
  if (!collYmd) {
    return { ok: true }
  }

  const trimmed = deadlineIso && String(deadlineIso).trim()
  if (!trimmed) {
    return {
      ok: false,
      message:
        'This vehicle has a planned collection date — set a work path deadline on or before that day.',
    }
  }

  const dl = new Date(trimmed)
  if (Number.isNaN(dl.getTime())) {
    return { ok: false, message: 'Invalid deadline.' }
  }

  const dlYmd = coerceToLocalYmd(dl)
  if (!dlYmd) {
    return { ok: false, message: 'Invalid deadline.' }
  }

  if (dlYmd > collYmd) {
    return {
      ok: false,
      message: `Work path deadline must be on or before the planned collection date (${collYmd}).`,
    }
  }

  return { ok: true }
}

/**
 * @param {string|null|undefined} deadlineIso
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateWorkPathDeadlineNotInPast(deadlineIso) {
  const trimmed = deadlineIso && String(deadlineIso).trim()
  if (!trimmed) return { ok: true }
  const t = new Date(trimmed).getTime()
  if (Number.isNaN(t)) return { ok: false, message: 'Invalid deadline.' }
  if (t < Date.now()) {
    return {
      ok: false,
      message: 'Work path deadline must be in the future.',
    }
  }
  return { ok: true }
}
