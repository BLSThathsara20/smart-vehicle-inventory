import { useAuth } from '../context/AuthContext'

export function RequirePermission({ permission, children }) {
  const { hasPermission, isSuperAdmin, refreshProfile } = useAuth()
  const allowed =
    !permission ||
    isSuperAdmin() ||
    hasPermission(permission) ||
    // Fallback: roles:manage implies admin-level access (super_admin or admin)
    (permission === 'users:manage' && hasPermission('roles:manage')) ||
    (permission === 'workflows:manage' && hasPermission('roles:manage'))
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
