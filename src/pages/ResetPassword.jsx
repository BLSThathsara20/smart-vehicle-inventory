import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useNotification } from '../context/NotificationContext'
import { Lock, Mail, ArrowLeft } from 'lucide-react'
import { Footer } from '../components/Footer'

export function ResetPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { addNotification } = useNotification()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      addNotification('Enter your email', 'error')
      return
    }
    setLoading(true)
    setSent(false)
    try {
      const redirectTo = `${window.location.origin}${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/login`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })
      if (error) throw error
      setSent(true)
      addNotification('Check your email for the reset link', 'success')
    } catch (err) {
      addNotification(err.message || 'Failed to send reset link', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-amber-400 text-sm mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Reset password</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Enter your email to receive a reset link</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                disabled={sent}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40 disabled:opacity-60"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || sent}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Sending...' : sent ? 'Check your email' : 'Send reset link'}
          </button>
        </form>

        {sent && (
          <p className="text-sm text-emerald-400 mt-4">
            We&apos;ve sent a password reset link to {email}. Check your inbox and spam folder.
          </p>
        )}
      </div>
      <Footer />
    </div>
  )
}
