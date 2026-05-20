import { getMessaging, getToken, onMessage, isSupported, deleteToken } from 'firebase/messaging'
import { app } from './firebase'

const FCM_SESSION_TOKEN_KEY = 'vi-fcm-token'

export function getFirebaseMessagingVapidKey() {
  return (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim()
}

export async function isFcmMessagingSupported() {
  if (typeof window === 'undefined' || !app) return false
  try {
    return await isSupported()
  } catch {
    return false
  }
}

function serviceWorkerUrl() {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  try {
    return new URL('firebase-messaging-sw.js', window.location.origin + prefix).href
  } catch {
    return `${prefix.replace(/^\//, '')}firebase-messaging-sw.js`
  }
}

function serviceWorkerScope() {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

/**
 * Registers the Firebase messaging service worker and returns an FCM registration token.
 * Requires Notification.permission === 'granted' and VITE_FIREBASE_VAPID_KEY.
 */
export async function ensureFcmRegistrationToken() {
  if (!app) return null
  if (!(await isFcmMessagingSupported())) return null
  const vapidKey = getFirebaseMessagingVapidKey()
  if (!vapidKey) return null
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null

  try {
    const messaging = getMessaging(app)
    const reg = await navigator.serviceWorker.register(serviceWorkerUrl(), {
      scope: serviceWorkerScope(),
    })
    await navigator.serviceWorker.ready
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
    if (token && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(FCM_SESSION_TOKEN_KEY, token)
    }
    return token || null
  } catch (e) {
    console.warn('[FCM] registration failed', e)
    return null
  }
}

export function getStoredFcmToken() {
  try {
    return sessionStorage.getItem(FCM_SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearStoredFcmToken() {
  try {
    sessionStorage.removeItem(FCM_SESSION_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

/** Unregisters this device token from FCM (best-effort). */
export async function deleteFcmRegistrationToken() {
  if (!app) return
  if (!(await isFcmMessagingSupported())) return
  try {
    const messaging = getMessaging(app)
    const tok = getStoredFcmToken()
    if (tok) await deleteToken(messaging)
  } catch {
    /* ignore */
  }
  clearStoredFcmToken()
}

/** @returns {() => void} unsubscribe */
export function subscribeForegroundFcm(handler) {
  if (!app) return () => {}
  let messaging
  try {
    messaging = getMessaging(app)
  } catch {
    return () => {}
  }
  return onMessage(messaging, handler)
}
