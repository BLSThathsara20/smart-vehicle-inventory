import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { Settings as SettingsIcon, LogOut, User } from 'lucide-react'

export function Settings() {
  const { user, signOut } = useAuth()
  const { addNotification } = useNotification()

  const handleSignOut = async () => {
    try {
      await signOut()
      addNotification('Signed out', 'info')
    } catch (err) {
      addNotification(err.message || 'Sign out failed', 'error')
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-orange-500" />
        Settings
      </h1>

      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
            <User className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="font-medium text-white">Super Admin</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
