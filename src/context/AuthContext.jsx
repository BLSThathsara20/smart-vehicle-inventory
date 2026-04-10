import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth, hasFirebaseConfig } from '../lib/firebase'
import { hasSanityConfig } from '../lib/sanity'
import {
  fetchProfileWithPermissions,
  ensureBootstrap,
  ensureUserProfileForFirebaseUser,
} from '../lib/sanityData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const configOk = hasFirebaseConfig() && hasSanityConfig

  useEffect(() => {
    if (!auth || !configOk) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          await ensureBootstrap()
          await ensureUserProfileForFirebaseUser(u)
        } catch {
          /* profile bootstrap best-effort */
        }
      }
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [configOk])

  useEffect(() => {
    if (!configOk || !user?.uid) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    fetchProfileWithPermissions(user.uid)
      .then((p) => setProfile(p))
      .finally(() => setProfileLoading(false))
  }, [configOk, user?.uid])

  const signIn = async (email, password) => {
    if (!auth) throw new Error('Firebase not configured')
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred
  }

  const signOutUser = async () => {
    if (!auth) return
    await signOut(auth)
    setProfile(null)
  }

  const signUp = async (email, password) => {
    if (!auth) throw new Error('Firebase not configured')
    return createUserWithEmailAndPassword(auth, email, password)
  }

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase not configured')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    return signInWithPopup(auth, provider)
  }

  const hasPermission = (code) => {
    if (profile) return profile.permissions?.includes(code) ?? false
    return false
  }

  const isSuperAdmin = () => {
    const role = profile?.role
    const name = Array.isArray(role) ? role?.[0]?.name : role?.name
    return String(name || '').toLowerCase() === 'super_admin'
  }

  const refreshProfile = () => {
    if (user?.uid) fetchProfileWithPermissions(user.uid).then(setProfile)
  }

  const ready = loading || (user && profileLoading)

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading: ready,
        configOk,
        signIn,
        signOut: signOutUser,
        signUp,
        signInWithGoogle,
        hasPermission,
        isSuperAdmin,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
