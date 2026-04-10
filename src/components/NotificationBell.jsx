import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchActiveAppNotifications } from '../lib/notificationService'

const POLL_MS = 45_000

export function NotificationBell() {
  const { user, hasPermission } = useAuth()
  const location = useLocation()
  const [count, setCount] = useState(0)

  const canView = hasPermission('inventory:view')

  const refresh = useCallback(async () => {
    if (!canView || !user?.uid) {
      setCount(0)
      return
    }
    try {
      const items = await fetchActiveAppNotifications(user.uid)
      setCount(items.length)
    } catch {
      setCount(0)
    }
  }, [canView, user?.uid])

  useEffect(() => {
    refresh()
  }, [refresh, location.pathname])

  useEffect(() => {
    if (!canView || !user?.uid) return undefined
    const id = window.setInterval(refresh, POLL_MS)
    const onFocus = () => {
      refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [canView, user?.uid, refresh])

  if (!canView) return null

  const display = count > 99 ? '99+' : String(count)

  return (
    <NavLink
      to="/app/notifications"
      className="relative inline-flex items-center justify-center w-11 h-11 rounded-xl border border-zinc-800/80 bg-zinc-900/80 hover:bg-zinc-800/90 transition shadow-lg shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
      aria-label={count ? `Notifications, ${count} items` : 'Notifications'}
    >
      <Bell
        className={`w-5 h-5 ${count > 0 ? 'text-amber-400 animate-bell-swing' : 'text-zinc-500'}`}
        strokeWidth={count > 0 ? 2.25 : 2}
      />
      {count > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-zinc-950 tabular-nums leading-none">
          {display}
        </span>
      ) : null}
    </NavLink>
  )
}
