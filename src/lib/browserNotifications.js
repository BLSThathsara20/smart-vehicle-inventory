/** User preference: use system/browser notifications for app alerts (tasks, viewings, etc.). */
export const BROWSER_PUSH_OPT_IN_KEY = 'vi-browser-push-opt-in'

/** One automatic permission prompt per browser session (avoids repeat popups). */
export const BROWSER_PUSH_SESSION_ASKED_KEY = 'vi-browser-push-session-asked'

/** Cooldown map: notification id -> last delivered timestamp (JSON in localStorage). */
const DELIVERED_KEY = 'vi-browser-notify-delivered-v1'
const MAX_DELIVERED_ENTRIES = 400
const SAME_ID_COOLDOWN_MS = 45 * 60 * 1000

export function isBrowserPushEnvironmentSupported() {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  try {
    if (window.isSecureContext) return true
  } catch {
    /* ignore */
  }
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

/** @returns {'granted'|'denied'|'default'|null} */
export function getNotificationPermission() {
  if (!isBrowserPushEnvironmentSupported()) return null
  return Notification.permission
}

/**
 * @returns {boolean|null} null = never set (first visit)
 */
export function getBrowserPushOptIn() {
  try {
    const v = localStorage.getItem(BROWSER_PUSH_OPT_IN_KEY)
    if (v === '1') return true
    if (v === '0') return false
    return null
  } catch {
    return null
  }
}

export function setBrowserPushOptIn(enabled) {
  try {
    localStorage.setItem(BROWSER_PUSH_OPT_IN_KEY, enabled ? '1' : '0')
  } catch {
    /* private mode */
  }
}

/** Default new devices to opted-in; user can turn off in Settings. */
export function ensureDefaultBrowserPushOptIn() {
  if (getBrowserPushOptIn() !== null) return
  setBrowserPushOptIn(true)
}

export function markBrowserPushSessionAsked() {
  try {
    sessionStorage.setItem(BROWSER_PUSH_SESSION_ASKED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function hasBrowserPushSessionAsked() {
  try {
    return sessionStorage.getItem(BROWSER_PUSH_SESSION_ASKED_KEY) === '1'
  } catch {
    return false
  }
}

function loadDeliveredMap() {
  try {
    const raw = localStorage.getItem(DELIVERED_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

function saveDeliveredMap(map) {
  try {
    const entries = Object.entries(map)
      .filter(([, t]) => typeof t === 'number' && !Number.isNaN(t))
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_DELIVERED_ENTRIES)
    const next = Object.fromEntries(entries)
    localStorage.setItem(DELIVERED_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function shouldDeliverBrowserNotification(id) {
  if (!id) return false
  const map = loadDeliveredMap()
  const last = map[id]
  if (!last) return true
  return Date.now() - last > SAME_ID_COOLDOWN_MS
}

export function markBrowserNotificationDelivered(id) {
  if (!id) return
  const map = loadDeliveredMap()
  map[id] = Date.now()
  const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000
  for (const k of Object.keys(map)) {
    if (map[k] < cutoff) delete map[k]
  }
  saveDeliveredMap(map)
}

/**
 * @returns {Promise<'granted'|'denied'|'default'>}
 */
export async function requestNotificationPermission() {
  if (!isBrowserPushEnvironmentSupported()) return 'denied'
  try {
    const r = await Notification.requestPermission()
    return r === 'granted' ? 'granted' : r === 'denied' ? 'denied' : 'default'
  } catch {
    return 'denied'
  }
}
