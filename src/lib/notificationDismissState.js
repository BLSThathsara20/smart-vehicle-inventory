const STORAGE_KEY = 'vehicle-inv-dismissed-notifications-v1'
const MAX_IDS = 400

export function getDismissedNotificationIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

/** Remember this feed item as seen so it no longer appears in the bell or list. */
export function dismissNotificationId(id) {
  if (id == null || id === '') return
  const s = getDismissedNotificationIds()
  s.add(String(id))
  const arr = [...s].slice(-MAX_IDS)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch {
    /* quota */
  }
}

export function filterUndismissedNotifications(items) {
  const dismissed = getDismissedNotificationIds()
  return (items || []).filter((n) => n?.id != null && !dismissed.has(String(n.id)))
}
