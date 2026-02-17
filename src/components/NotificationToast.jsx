import { useNotification } from '../context/NotificationContext'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const colors = {
  success: 'bg-emerald-600/95',
  error: 'bg-red-600/95',
  info: 'bg-orange-500/95',
}

export function NotificationToast() {
  const { notifications, removeNotification } = useNotification()

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-4 sm:max-w-sm">
      {notifications.map(({ id, message, type }) => {
        const Icon = icons[type] || Info
        const bg = colors[type] || colors.info
        return (
          <div
            key={id}
            className={`${bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1 text-sm">{message}</p>
            <button
              onClick={() => removeNotification(id)}
              className="p-1 hover:bg-white/20 rounded transition"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
