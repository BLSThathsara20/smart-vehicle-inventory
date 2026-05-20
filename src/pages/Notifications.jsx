import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { fetchActiveAppNotifications } from '../lib/notificationService'
import { dismissViewingStaffAlert } from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { LoadingState } from '../components/LoadingState'
import {
  Bell,
  Car,
  Calendar,
  CalendarClock,
  ClipboardCheck,
  AlertTriangle,
  ClipboardList,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AtSign,
  UserPlus,
} from 'lucide-react'

const PAGE_SIZE = 12

export function Notifications() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, hasPermission } = useAuth()
  const canSettings = hasPermission('settings:view')
  const { addNotification } = useNotification()
  const canView = hasPermission('inventory:view')
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadMessage, setLoadMessage] = useState('Loading notifications…')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!canView || !user?.uid) {
      setLoading(false)
      setNotifications([])
      return
    }
    loadNotifications()
  }, [canView, user?.uid, location.pathname])

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE))
    setPage((p) => Math.min(p, tp))
  }, [notifications.length])

  async function loadNotifications() {
    if (!user?.uid) return
    setLoading(true)
    setLoadMessage('Fetching notifications…')
    try {
      const items = await fetchActiveAppNotifications(user.uid)
      setNotifications(items)
      setPage(1)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (type) => {
    if (type === 'delivery_today' || type === 'delivery_soon') return Calendar
    if (type === 'viewing_today' || type === 'viewing_soon') return CalendarClock
    if (type === 'viewing_manager_alert' || type === 'viewing_mention' || type === 'viewing_team_ping')
      return AtSign
    if (type === 'pdi_due') return ClipboardCheck
    if (type === 'mot_expiry') return AlertTriangle
    if (type === 'work_assigned') return ClipboardList
    if (type === 'work_comment') return MessageCircle
    if (type === 'staff_signup_pending') return UserPlus
    return Car
  }

  function openNotification(n) {
    if (n.navigateTo) {
      navigate(n.navigateTo)
      return
    }
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

  async function dismissAlert(n) {
    if (!user?.uid || !n.vehicleId || !n.bookingKey) return
    try {
      await dismissViewingStaffAlert(n.vehicleId, n.bookingKey, user.uid)
      await loadNotifications()
    } catch (err) {
      addNotification(err.message || 'Could not dismiss', 'error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pagedNotifications = notifications.slice(pageStart, pageStart + PAGE_SIZE)
  const showPagination = notifications.length > PAGE_SIZE

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
          Viewings and customer collections show when they&apos;re{' '}
          <strong className="text-zinc-400">today, tomorrow, or the day after</strong> (calendar days in your timezone), with times like &quot;tomorrow at 11:00 PM&quot; on
          bookings. MOT, prep-path work, PDI before collection (same window), team viewing alerts, and{' '}
          <strong className="text-zinc-400">pending Google staff sign-ups</strong> (for admins) appear here too. Items disappear when dates pass or the
          underlying record changes.
        </p>
        {canSettings ? (
          <p className="text-zinc-600 text-sm mt-2">
            <Link to="/app/settings" className="text-amber-500 hover:text-amber-400 font-medium">
              Browser notifications
            </Link>{' '}
            — get device alerts when you are not in the app (optional; you can turn them off in Settings).
          </p>
        ) : null}
      </div>

      {loading ? (
        <LoadingState message={loadMessage} variant="embedded" className="py-24" />
      ) : notifications.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-zinc-800/50 bg-zinc-900/40">
          <Bell className="w-14 h-14 mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400 font-medium">No notifications</p>
          <p className="text-zinc-500 text-sm mt-1">All clear — no upcoming deliveries or due items</p>
        </div>
           ) : (
        <>
          <div className="space-y-3">
            {pagedNotifications.map((n) => {
              const Icon = getIcon(n.type)
              const isHigh = n.severity === 'high' && !n.relevantTaskDone
              const done = n.relevantTaskDone === true
              const borderCls = done
                ? 'bg-emerald-500/10 border-emerald-500/35'
                : isHigh
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-zinc-900/50 border-zinc-800/60'
              return (
                <div key={n.id} className={`rounded-xl border overflow-hidden ${borderCls}`}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className="w-full text-left p-4 transition hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          done
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isHigh
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-zinc-800/60 text-zinc-400'
                        }`}
                      >
                        {done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`font-semibold text-sm ${
                              done ? 'text-emerald-300' : isHigh ? 'text-amber-400' : 'text-white'
                            }`}
                          >
                            {n.title}
                          </p>
                          {done ? (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                              Handled
                            </span>
                          ) : null}
                        </div>
                        <p className={`text-xs mt-0.5 ${done ? 'text-emerald-200/70' : 'text-zinc-500'}`}>
                          {n.message}
                        </p>
                        {n.dueDate && (
                          <p className={`text-[10px] mt-1 ${done ? 'text-emerald-200/45' : 'text-zinc-600'}`}>
                            Due: {new Date(n.dueDate).toLocaleDateString()}
                          </p>
                        )}
                        {n.created_at && (
                          <p className={`text-[10px] mt-1 ${done ? 'text-emerald-200/45' : 'text-zinc-600'}`}>
                            {new Date(n.created_at).toLocaleString(undefined, {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                  {n.dismissable && !done && user?.uid ? (
                    <div className="px-4 pb-3 pt-0 flex justify-end border-t border-zinc-800/40">
                      <button
                        type="button"
                        onClick={() => dismissAlert(n)}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-300 py-1"
                      >
                        Dismiss alert
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {showPagination ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-8 pt-6 border-t border-zinc-800/50">
              <p className="text-xs text-zinc-500 tabular-nums">
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, notifications.length)} of{' '}
                {notifications.length}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900/80 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-xs text-zinc-400 tabular-nums px-2">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900/80 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
