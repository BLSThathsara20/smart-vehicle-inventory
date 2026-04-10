import { useEffect, useState } from 'react'
import { fetchAllRoles, fetchAllPermissions, updateRolePermissions } from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { Shield, ChevronDown, ChevronRight, Loader2, Save } from 'lucide-react'

export function Roles() {
  const { hasPermission } = useAuth()
  const { addNotification } = useNotification()
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [rolePerms, setRolePerms] = useState({})
  const [expandedRole, setExpandedRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  const canManage = hasPermission('roles:manage')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [rolesData, permsData] = await Promise.all([fetchAllRoles(), fetchAllPermissions()])
      setRoles(rolesData || [])
      setPermissions(permsData || [])

      const map = {}
      ;(rolesData || []).forEach((r) => {
        map[r.id] = new Set(r.permission_ids || [])
      })
      setRolePerms(map)
    } catch (err) {
      addNotification(err.message || 'Failed to load roles', 'error')
    } finally {
      setLoading(false)
    }
  }

  function isChecked(roleId, permId) {
    return rolePerms[roleId]?.has(permId) ?? false
  }

  function togglePerm(roleId, permId) {
    if (!canManage) return
    const role = roles.find((r) => r.id === roleId)
    if (role?.is_system) return
    setRolePerms((prev) => {
      const next = { ...prev }
      if (!next[roleId]) next[roleId] = new Set()
      const set = new Set(next[roleId])
      if (set.has(permId)) set.delete(permId)
      else set.add(permId)
      next[roleId] = set
      return next
    })
  }

  async function saveRole(roleId) {
    setSaving(roleId)
    try {
      const role = roles.find((r) => r.id === roleId)
      if (role?.is_system) {
        addNotification('System roles cannot be modified', 'error')
        return
      }
      const permIds = [...(rolePerms[roleId] || [])]
      await updateRolePermissions(roleId, permIds)
      addNotification('Permissions saved', 'success')
    } catch (err) {
      addNotification(err.message || 'Failed to save', 'error')
    } finally {
      setSaving(null)
    }
  }

  const byCategory = permissions.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  if (!canManage) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to manage roles.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-amber-500/80 animate-spin mb-3" />
        <p className="text-zinc-500 text-sm">Loading roles...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-amber-500" />
          Roles & Permissions
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Set access levels for each role. Click a role to check or uncheck permissions.
        </p>
      </div>

      <div className="space-y-3">
        {roles.map((role) => {
          const isExpanded = expandedRole === role.id
          const isSystem = role.is_system
          const permCount = rolePerms[role.id]?.size ?? 0

          return (
            <div
              key={role.id}
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedRole(isExpanded ? null : role.id)}
                className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-zinc-800/30 transition"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-zinc-500" />
                  )}
                  <span className="font-semibold text-white">{role.name}</span>
                  {isSystem && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">
                      System
                    </span>
                  )}
                </div>
                <span className="text-zinc-500 text-sm">
                  {permCount} permission{permCount !== 1 ? 's' : ''}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-zinc-800/60 p-4 space-y-6">
                  {role.description && (
                    <p className="text-zinc-500 text-sm">{role.description}</p>
                  )}
                  {isSystem ? (
                    <p className="text-zinc-500 text-sm">System roles have full access and cannot be edited.</p>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {Object.entries(byCategory).map(([category, perms]) => (
                          <div key={category}>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                              {category}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {perms.map((perm) => (
                                <label
                                  key={perm.id}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/60 hover:border-zinc-600 cursor-pointer transition"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked(role.id, perm.id)}
                                    onChange={() => togglePerm(role.id, perm.id)}
                                    className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/40"
                                  />
                                  <span className="text-sm text-zinc-300">{perm.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => saveRole(role.id)}
                        disabled={saving === role.id}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium transition disabled:opacity-50"
                      >
                        {saving === role.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save changes
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
