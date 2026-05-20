import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { fetchActiveAppNotifications } from '../lib/notificationService'
import { mergeFcmWebTokenIntoProfile } from '../lib/sanityData'
import {
  isBrowserPushEnvironmentSupported,
  getBrowserPushOptIn,
  ensureDefaultBrowserPushOptIn,
  hasBrowserPushSessionAsked,
  markBrowserPushSessionAsked,
  requestNotificationPermission,
  shouldDeliverBrowserNotification,
  markBrowserNotificationDelivered,
} from '../lib/browserNotifications'
import {
  ensureFcmRegistrationToken,
  getFirebaseMessagingVapidKey,
  isFcmMessagingSupported,
  subscribeForegroundFcm,
} from '../lib/firebaseMessaging'

const POLL_MS = 60_000

function openNotificationRoute(navigate, n) {
  if (n.instanceId && n.vehicleId) {
    navigate(`/app/work/${n.vehicleId}/${n.instanceId}`)
    return
  }
  if (n.vehicleId) {
    if (n.dismissable && n.bookingKey) {
      navigate(`/vehicle/${n.vehicleId}?viewings=1`)
      return
    }
    navigate(`/vehicle/${n.vehicleId}`)
  }
}

export function BrowserNotificationManager() {
  const navigate = useNavigate()
  const { addNotification } = useNotification()
  const { user, profile, hasPermission } = useAuth()
  const canView = hasPermission('inventory:view')
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const [permSyncTick, setPermSyncTick] = useState(0)

  useEffect(() => {
    const bump = () => setPermSyncTick((t) => t + 1)
    document.addEventListener('visibilitychange', bump)
    window.addEventListener('focus', bump)
    window.addEventListener('vi-notify-permission-changed', bump)
    return () => {
      document.removeEventListener('visibilitychange', bump)
      window.removeEventListener('focus', bump)
      window.removeEventListener('vi-notify-permission-changed', bump)
    }
  }, [])

  const tryPollAndNotify = useCallback(async () => {
    if (!canView || !user?.uid) return
    if (!isBrowserPushEnvironmentSupported()) return
    if (getBrowserPushOptIn() !== true) return
    if (Notification.permission !== 'granted') return

    try {
      const items = await fetchActiveAppNotifications(user.uid)
      for (const n of items) {
        if (n.relevantTaskDone) continue
        if (!shouldDeliverBrowserNotification(n.id)) continue
        const body = (n.message || '').slice(0, 240)
        let notif
        try {
          notif = new Notification(n.title || 'Car Inventory', {
            body: body || undefined,
            tag: String(n.id).slice(0, 64),
          })
        } catch {
          continue
        }
        markBrowserNotificationDelivered(n.id)
        notif.onclick = () => {
          try {
            window.focus()
          } catch {
            /* ignore */
          }
          notif.close()
          openNotificationRoute(navigateRef.current, n)
        }
      }
    } catch {
      /* ignore */
    }
  }, [canView, user?.uid])

  useEffect(() => {
    if (!canView || !user?.uid) return undefined
    if (!isBrowserPushEnvironmentSupported()) return undefined

    ensureDefaultBrowserPushOptIn()

    if (getBrowserPushOptIn() === true && Notification.permission === 'default' && !hasBrowserPushSessionAsked()) {
      markBrowserPushSessionAsked()
      requestNotificationPermission()
    }

    tryPollAndNotify()
    const id = window.setInterval(tryPollAndNotify, POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'hidden') tryPollAndNotify()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [canView, user?.uid, tryPollAndNotify])

  useEffect(() => {
    if (!profile?.id || !user?.uid || !canView) return undefined
    if (getBrowserPushOptIn() !== true) return undefined
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return undefined
    if (!getFirebaseMessagingVapidKey()) return undefined

    let cancelled = false
    ;(async () => {
      if (!(await isFcmMessagingSupported())) return
      const token = await ensureFcmRegistrationToken()
      if (cancelled || !token) return
      try {
        await mergeFcmWebTokenIntoProfile(profile.id, token)
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [profile?.id, user?.uid, canView, permSyncTick])

  useEffect(() => {
    if (!canView || !user?.uid) return undefined
    if (getBrowserPushOptIn() !== true) return undefined
    if (!getFirebaseMessagingVapidKey()) return undefined

    const unsub = subscribeForegroundFcm((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Notification'
      const body = payload.notification?.body || payload.data?.body || ''
      addNotification(body ? `${title}: ${body}` : title, 'info')
    })
    return () => {
      try {
        unsub()
      } catch {
        /* ignore */
      }
    }
  }, [canView, user?.uid, addNotification, permSyncTick])

  return null
}
