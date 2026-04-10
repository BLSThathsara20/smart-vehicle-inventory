import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchActiveAppNotifications } from '../lib/notificationService'
import { dismissNotificationId } from '../lib/notificationDismissState'
import { useAuth } from '../context/AuthContext'
import {
  Bell,
  Loader2,
  Car,
  Calendar,
  ClipboardCheck,
  AlertTriangle,
  ClipboardList,
  MessageCircle,
} from 'lucide-react'

export function Notifications() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const canView = hasPermission('inventory:view')
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canView || !user?.uid) {
      setLoading(false)
      setNotifications([])
      return
    }
    loadNotifications()
  }, [canView, user?.uid])

  async function loadNotifications() {
    if (!user?.uid) return
    setLoading(true)
    try {
      const items = await fetchActiveAppNotifications(user.uid)
      setNotifications(items)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (type) => {
    if (type === 'delivery_today' || type === 'delivery_soon') return Calendar
    if (type === 'pdi_due') return ClipboardCheck
    if (type === 'mot_expiry') return AlertTriangle
    if (type === 'work_assigned') return ClipboardList
    if (type === 'work_comment') return MessageCircle
    return Car
  }

  function openNotification(n) {
    dismissNotificationId(n.id)
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    if (n.instanceId && n.vehicleId) {
      navigate(`/app/work/${n.vehicleId}/${n.instanceId}`)
      return
    }
    if (n.vehicleId) {
      navigate(`/vehicle/${n.vehicleId}`)
    }
  }

  if (!canView) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to view notifications.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-amber-500" />
          Notifications
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Deliveries, PDI &amp; MOT, prep-path assignments, and comments (including direct messages).
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-amber-500/80 animate-spin mb-3" />
          <p className="text-zinc-500 text-sm">Loading...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-zinc-800/50 bg-zinc-900/40">
          <Bell className="w-14 h-14 mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400 font-medium">No notifications</p>
          <p className="text-zinc-500 text-sm mt-1">All clear — no upcoming deliveries or due items</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = getIcon(n.type)
            const isHigh = n.severity === 'high'
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotification(n)}
                className={`w-full text-left p-4 rounded-xl border transition ${
                  isHigh
                    ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
                    : 'bg-zinc-900/50 border-zinc-800/60 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isHigh ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800/60 text-zinc-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${isHigh ? 'text-amber-400' : 'text-white'}`}>{n.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{n.message}</p>
                    {n.dueDate && (
                      <p className="text-[10px] text-zinc-600 mt-1">
                        Due: {new Date(n.dueDate).toLocaleDateString()}
                      </p>
                    )}
                    {n.created_at && (
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {new Date(n.created_at).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
