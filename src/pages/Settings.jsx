import { useState, useEffect } from 'react'
import { updatePassword } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { updateUserProfileDoc } from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { Settings as SettingsIcon, LogOut, User, Lock, Save, Loader2 } from 'lucide-react'

export function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const { addNotification } = useNotification()
  const [displayName, setDisplayName] = useState('')
  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
  }, [profile?.display_name])
  const [savingProfile, setSavingProfile] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      addNotification('Signed out', 'info')
    } catch (err) {
      addNotification(err.message || 'Sign out failed', 'error')
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      if (!profile?.id) throw new Error('No profile')
      await updateUserProfileDoc(profile.id, { display_name: displayName.trim() || null })
      addNotification('Profile updated', 'success')
      refreshProfile()
    } catch (err) {
      addNotification(err.message || 'Failed to update profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      addNotification('Passwords do not match', 'error')
      return
    }
    if (newPassword.length < 6) {
      addNotification('Password must be at least 6 characters', 'error')
      return
    }
    setSavingPassword(true)
    try {
      if (!auth?.currentUser) throw new Error('Not signed in')
      await updatePassword(auth.currentUser, newPassword)
      addNotification('Password updated', 'success')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      addNotification(err.message || 'Failed to update password', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-amber-500" />
        Settings
      </h1>

      <div className="space-y-8">
        {/* Account info */}
        <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Account</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
              <User className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-white">{profile?.role?.name?.replace('_', ' ') || 'User'}</p>
              <p className="text-sm text-zinc-500">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium transition disabled:opacity-50"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save profile
            </button>
          </form>
        </section>

        {/* Change password */}
        <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Change password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition disabled:opacity-50"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Update password
            </button>
          </form>
        </section>

        {/* Sign out */}
        <section>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-zinc-700/80 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </section>
      </div>
    </div>
  )
}
