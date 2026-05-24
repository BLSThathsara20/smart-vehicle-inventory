import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingState } from './LoadingState'

/**
 * Opens `/vehicle/:id` (pricing, workflows, CRM). Any permission tied to dealer staff nav is listed so
 * deep links/notifications/search still work; stub guests have none of these (public `/find` only).
 */
export const VEHICLE_INTERNAL_DETAIL_PERM_CODES = [
  'inventory:view',
  'search:view',
  'inventory:add',
  'inventory:edit',
  'inventory:delete',
  'analytics:view',
  'users:manage',
  'roles:manage',
  'health:view',
  'space:view',
  'settings:view',
  'workflows:create',
  'workflows:edit',
  'workflows:manage',
]

export function RequirePermission({ permission, anyOf, children, redirectTo = null }) {
  const { hasPermission, isSuperAdmin, refreshProfile, loading } = useAuth()
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

  if (loading) {
    return (
      <LoadingState message="Checking access…" variant="embedded" className="min-h-[42vh]" />
    )
  }

  if (allowed) return children

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />
  }

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
