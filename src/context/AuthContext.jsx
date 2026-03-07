import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function fetchProfileWithPermissions(userId) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      role_id,
      email,
      display_name,
      role:roles (
        id,
        name,
        description
      )
    `)
    .eq('user_id', userId)
    .single()

  if (profileError || !profile) return null

  const { data: perms } = await supabase
    .from('role_permissions')
    .select('permission:permissions(code)')
    .eq('role_id', profile.role_id)

  const permissionCodes = (perms || [])
    .map((p) => p.permission?.code)
    .filter(Boolean)

  return {
    ...profile,
    permissions: permissionCodes,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    fetchProfileWithPermissions(user.id).then((p) => {
      setProfile(p)
      setProfileLoading(false)
    })
  }, [user?.id])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
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
    if (user?.id) fetchProfileWithPermissions(user.id).then(setProfile)
  }

  const ready = loading || (user && profileLoading)

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading: ready,
        signIn,
        signOut,
        signUp,
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
