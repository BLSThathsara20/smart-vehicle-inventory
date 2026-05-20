import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import {
  isBrowserPushEnvironmentSupported,
  getNotificationPermission,
  getBrowserPushOptIn,
  setBrowserPushOptIn,
  requestNotificationPermission,
} from '../lib/browserNotifications'
import { useNotification } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'
import { removeFcmWebTokenFromProfile } from '../lib/sanityData'
import {
  deleteFcmRegistrationToken,
  getFirebaseMessagingVapidKey,
  getStoredFcmToken,
} from '../lib/firebaseMessaging'

export function BrowserNotificationsPrefs() {
  const { addNotification } = useNotification()
  const { profile } = useAuth()
  const [supported, setSupported] = useState(false)
  const [optIn, setOptIn] = useState(false)
  const [permission, setPermission] = useState(null)
  const [busy, setBusy] = useState(false)

  function syncFromStorage() {
    setSupported(isBrowserPushEnvironmentSupported())
    setPermission(getNotificationPermission())
    const o = getBrowserPushOptIn()
    setOptIn(o === true)
  }

  useEffect(() => {
    syncFromStorage()
    const refresh = () => {
      setPermission(getNotificationPermission())
      const o = getBrowserPushOptIn()
      setOptIn(o === true)
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  async function handleToggle(enable) {
    if (!supported) {
      addNotification('Browser notifications are not supported in this environment', 'info')
      return
    }
    setBusy(true)
    try {
      if (enable) {
        const p = permission === 'default' ? await requestNotificationPermission() : getNotificationPermission()
        setPermission(p)
        if (p !== 'granted') {
          addNotification(
            p === 'denied'
              ? 'Notifications are blocked for this site. Enable them in your browser settings if you change your mind.'
              : 'Permission was not granted — alerts stay off until you allow notifications.',
            p === 'denied' ? 'error' : 'info'
          )
          setBrowserPushOptIn(false)
          setOptIn(false)
          return
        }
        setBrowserPushOptIn(true)
        setOptIn(true)
        addNotification('Browser notifications are on — we will alert you about new tasks and reminders.', 'success')
        window.dispatchEvent(new Event('vi-notify-permission-changed'))
      } else {
        setBrowserPushOptIn(false)
        setOptIn(false)
        try {
          const tok = getStoredFcmToken()
          if (profile?.id && tok) await removeFcmWebTokenFromProfile(profile.id, tok)
          await deleteFcmRegistrationToken()
        } catch {
          /* ignore */
        }
        addNotification('Browser notifications are off in this app. You can turn them on again anytime.', 'info')
        window.dispatchEvent(new Event('vi-notify-permission-changed'))
      }
    } finally {
      setBusy(false)
    }
  }

  if (!supported) {
    return (
      <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <BellOff className="w-4 h-4 text-zinc-500" />
          Browser notifications
        </h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Your browser or connection does not support notifications here (use HTTPS, or a recent version of Chrome,
          Edge, or Safari). On iPhone, add this app to your Home Screen for the best results.
        </p>
      </section>
    )
  }

  const denied = permission === 'denied'
  const hasVapid = Boolean(getFirebaseMessagingVapidKey())

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <Bell className="w-4 h-4 text-amber-500" />
        Browser notifications
      </h2>
      {!hasVapid ? (
        <p className="text-xs text-amber-500/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mb-4 leading-relaxed">
          For <strong className="text-amber-400">Firebase Cloud Messaging</strong> (alerts when the app is closed), add{' '}
          <code className="text-amber-300">VITE_FIREBASE_VAPID_KEY</code> from Firebase Console → Cloud Messaging → Web
          push certificates, then rebuild the app.
        </p>
      ) : null}
      <p className="text-sm text-zinc-400 leading-relaxed mb-4">
        Get alerts for prep-path assignments, team messages, viewings, and delivery reminders — including when this tab
        is in the background on your phone. This uses your browser&apos;s permission; you can turn alerts off here
        anytime without changing browser settings.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={optIn && permission === 'granted'}
            disabled={busy}
            onClick={() => handleToggle(!optIn)}
            className={`relative w-12 h-7 rounded-full transition shrink-0 ${
              optIn && permission === 'granted' ? 'bg-amber-500' : 'bg-zinc-700'
            } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                optIn && permission === 'granted' ? 'translate-x-5' : ''
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium text-white">
              {optIn && permission === 'granted'
                ? 'Alerts enabled'
                : denied
                  ? 'Blocked in browser'
                  : optIn
                    ? 'Waiting for permission'
                    : 'Alerts disabled'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {denied
                ? 'Open browser site settings for this page and allow notifications, then turn the switch on again.'
                : permission === 'granted'
                  ? 'You may still manage sounds and banners in your system settings.'
                  : 'We will ask your browser once when you enable this.'}
            </p>
          </div>
        </div>
        {busy ? <Loader2 className="w-5 h-5 animate-spin text-zinc-500 shrink-0" /> : null}
      </div>
    </section>
  )
}
