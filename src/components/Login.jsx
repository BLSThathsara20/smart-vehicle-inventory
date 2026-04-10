import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { Car, Lock, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import { Footer } from './Footer'

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const { addNotification } = useNotification()

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      addNotification('Signed in with Google', 'success')
    } catch (err) {
      const code = err?.code
      if (code === 'auth/popup-closed-by-user') {
        addNotification('Sign-in cancelled', 'info')
      } else {
        addNotification(err.message || 'Google sign-in failed', 'error')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        addNotification('Welcome back!', 'success')
      } else {
        await signUp(email, password)
        addNotification('Account created — you are signed in.', 'success')
      }
    } catch (err) {
      addNotification(err.message || 'Something went wrong', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center">
            <Car className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          Vehicle Inventory
        </h1>
        <p className="text-slate-400 text-center text-sm mb-6">
          Sign in with Google — your profile is saved automatically. Or use email below.
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {googleLoading ? (
            <span className="text-slate-600">Connecting…</span>
          ) : (
            <>
              <GoogleIcon className="w-5 h-5 shrink-0" />
              Continue with Google
            </>
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="px-2 bg-slate-900 text-slate-500">Or email</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowEmailForm((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-400 hover:text-white transition mb-2"
        >
          {showEmailForm ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide email sign-in
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Sign in or register with email & password
            </>
          )}
        </button>

        {showEmailForm && (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-800 mt-2">
          <p className="text-center text-xs text-slate-500 mb-2">
            {mode === 'signin' ? 'Sign in' : 'New account'} — still creates your Sanity profile on first sign-in.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required={showEmailForm}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required={showEmailForm}
                minLength={6}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create account'}
          </button>
          <p className="text-center text-sm text-slate-400">
            {mode === 'signin' ? (
              <>
                No account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
          {mode === 'signin' && (
            <p className="text-center text-sm mt-2">
              <Link to="/reset-password" className="text-amber-400 hover:text-amber-300">
                Forgot password?
              </Link>
            </p>
          )}
        </form>
        )}
      </div>
      <Footer />
    </div>
  )
}
