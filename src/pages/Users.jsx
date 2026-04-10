import { useEffect, useMemo, useState } from 'react'
import { createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import { getSecondaryAuth } from '../lib/firebase'
import {
  fetchAllUserProfiles,
  fetchAllRoles,
  createUserProfileDoc,
  updateUserProfileDoc,
  deleteUserProfileDoc,
} from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { Users as UsersIcon, Plus, Pencil, Loader2, X, Mail, Lock, Trash2 } from 'lucide-react'

export function Users() {
  const { user: currentUser, hasPermission, isSuperAdmin, refreshProfile } = useAuth()
  const { addNotification } = useNotification()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [deleteUser, setDeleteUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all')

  const canManage = hasPermission('users:manage') || hasPermission('roles:manage') || isSuperAdmin()

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'all') return users
    return users.filter((u) => u.role?.name === roleFilter)
  }, [users, roleFilter])

  const superAdmins = users.filter((u) => u.role?.name === 'super_admin')
  const oldestSuperAdminId = superAdmins.length
    ? superAdmins.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]?.user_id
    : null

  function canDeleteUser(u) {
    if (u.user_id === currentUser?.uid) return false
    if (u.role?.name !== 'super_admin') return true
    return u.user_id !== oldestSuperAdminId
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [profilesRes, rolesRes] = await Promise.all([fetchAllUserProfiles(), fetchAllRoles()])
      setUsers(profilesRes || [])
      setRoles(rolesRes || [])
    } catch (err) {
      addNotification(err.message || 'Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!canManage) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to manage users.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-amber-500" />
            Users
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Add, edit, and manage user accounts</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-[15px] transition min-w-[140px]"
        >
          <Plus className="w-5 h-5 shrink-0" />
          Add User
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 mb-6">
        <label htmlFor="user-role-filter" className="text-sm text-zinc-500 shrink-0">
          Filter by role
        </label>
        <select
          id="user-role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full sm:w-64 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white text-sm focus:ring-2 focus:ring-amber-500/40"
        >
          <option value="all">All roles</option>
          {[...(roles || [])]
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            .map((r) => (
              <option key={r.id} value={r.name}>
                {String(r.name || '').replace(/_/g, ' ')}
              </option>
            ))}
        </select>
        {roleFilter !== 'all' && (
          <span className="text-xs text-zinc-600">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-amber-500/80 animate-spin mb-3" />
          <p className="text-zinc-500 text-sm">Loading users...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <p className="text-zinc-500 text-sm py-8 text-center">No users match this role.</p>
          ) : (
          filteredUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-start justify-between gap-3 p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/50"
            >
              <div className="flex gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 shrink-0 rounded-full bg-zinc-800 flex items-center justify-center">
                  <span className="text-amber-400 font-semibold text-sm">
                    {(u.display_name || u.email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-medium text-white truncate" title={u.display_name || u.email}>
                    {u.display_name || u.email}
                  </p>
                  <p className="text-sm text-zinc-500 truncate" title={u.email}>
                    {u.email}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {u.role?.name?.replace('_', ' ')} · Joined {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {u.user_id === currentUser?.uid ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400">
                    You
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditUser(u)}
                      className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                      aria-label="Edit user"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {canDeleteUser(u) && (
                      <button
                        type="button"
                        onClick={() => setDeleteUser(u)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition"
                        aria-label="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
          )}
        </div>
      )}

      {addOpen && (
        <AddUserModal
          roles={roles.filter((r) => r.name !== 'super_admin')}
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false)
            fetchData()
          }}
          addNotification={addNotification}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          roles={roles.filter((r) => r.name !== 'super_admin')}
          onClose={() => setEditUser(null)}
          onSuccess={() => {
            setEditUser(null)
            fetchData()
            if (editUser.user_id === currentUser?.uid) refreshProfile()
          }}
          addNotification={addNotification}
        />
      )}

      {deleteUser && (
        <DeleteUserModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onSuccess={() => {
            setDeleteUser(null)
            fetchData()
          }}
          addNotification={addNotification}
        />
      )}
    </div>
  )
}

const getResetPasswordUrl = () => {
  if (typeof window === 'undefined') return ''
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return `${window.location.origin}${base}/reset-password`
}

function AddUserModal({ roles, onClose, onSuccess, addNotification }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createdUrl, setCreatedUrl] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password || !roleId) {
      addNotification('Email, password, and role are required', 'error')
      return
    }
    if (password.length < 6) {
      addNotification('Password must be at least 6 characters', 'error')
      return
    }
    setSaving(true)
    setCreatedUrl(null)
    try {
      const secondary = getSecondaryAuth()
      if (!secondary) throw new Error('Auth not configured')
      const cred = await createUserWithEmailAndPassword(secondary, email.trim(), password)
      await firebaseSignOut(secondary)
      await createUserProfileDoc({
        firebase_uid: cred.user.uid,
        email: email.trim(),
        display_name: displayName || '',
        role_id: roleId,
      })
      addNotification('User created successfully', 'success')
      setCreatedUrl(getResetPasswordUrl())
    } catch (err) {
      addNotification(err.message || 'Failed to add user', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setCreatedUrl(null)
    onClose()
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={handleClose}>
      <div
        className="bg-zinc-900 rounded-2xl border border-zinc-700/80 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-zinc-700/80">
          <h3 className="text-lg font-semibold text-white">Add User</h3>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdUrl ? (
          <div className="p-5 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="font-medium text-emerald-400">User created successfully</p>
              <p className="text-sm text-zinc-400 mt-2">Share this link with them to set their password:</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdUrl}
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/80 text-sm text-amber-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(createdUrl)
                    addNotification('Link copied', 'success')
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-sm"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-3">They enter their email at this page to receive a reset link and set a new password.</p>
            </div>
            <button type="button" onClick={handleClose} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium">
              Done
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Temporary password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">Share the reset link below with them instead — they can set their own password.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional"
              className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="">Select role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 py-3 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium transition disabled:opacity-50">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Add User'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

function EditUserModal({ user, roles, onClose, onSuccess, addNotification }) {
  const isSuperAdmin = user.role?.name === 'super_admin'
  const [displayName, setDisplayName] = useState(user.display_name || '')
  const [roleId, setRoleId] = useState(user.role_id || user.role?.id || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateUserProfileDoc(user.id, {
        display_name: displayName || null,
        ...(isSuperAdmin ? {} : { role_id: roleId }),
      })
      addNotification('User updated', 'success')
      onSuccess()
    } catch (err) {
      addNotification(err.message || 'Failed to update', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl border border-zinc-700/80 shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-zinc-700/80">
          <h3 className="text-lg font-semibold text-white">Edit User</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Email</label>
            <p className="text-zinc-300 py-2">{user.email}</p>
            <p className="text-xs text-zinc-500">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional"
              className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Role</label>
            {isSuperAdmin ? (
              <p className="text-zinc-300 py-2">Super admin (cannot be changed)</p>
            ) : (
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white focus:ring-2 focus:ring-amber-500/40"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium transition disabled:opacity-50">
              {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteUserModal({ user, onClose, onSuccess, addNotification }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteUserProfileDoc(user.id)
      addNotification('User deleted', 'success')
      onSuccess()
    } catch (err) {
      addNotification(err.message || 'Failed to delete user', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl border border-zinc-700/80 shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-zinc-700/80">
          <h3 className="text-lg font-semibold text-white">Delete User</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-zinc-300">
            Delete <span className="font-medium text-white">{user.display_name || user.email}</span>? This will remove them from the app.
          </p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
