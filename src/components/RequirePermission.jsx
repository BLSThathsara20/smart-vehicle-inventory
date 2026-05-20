import { useAuth } from '../context/AuthContext'

export function RequirePermission({ permission, anyOf, children }) {
  const { hasPermission, isSuperAdmin, refreshProfile } = useAuth()
  const codes =
    Array.isArray(anyOf) && anyOf.length > 0 ? anyOf : permission ? [permission] : []
  const touchesWorkflows = codes.some((c) => String(c).startsWith('workflows:'))
  const allowed =
    codes.length === 0 ||
    isSuperAdmin() ||
    codes.some((c) => hasPermission(c)) ||
    // Fallback: roles:manage implies admin-level access (super_admin or admin)
    (codes.includes('users:manage') && hasPermission('roles:manage')) ||
    (touchesWorkflows && hasPermission('roles:manage'))
  if (allowed) return children
  return (
    <div className="p-4 space-y-3">
      <p className="text-zinc-400">You don&apos;t have permission to access this page.</p>
      <button
        type="button"
        onClick={() => refreshProfile()}
        className="text-sm text-amber-400 hover:text-amber-300"
      >
        Refresh permissions
      </button>
    </div>
  )
}
