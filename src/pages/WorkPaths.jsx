import { useEffect, useMemo, useState } from 'react'
import {
  fetchAllWorkPaths,
  fetchAllRoles,
  fetchAllUserProfiles,
  createWorkPath,
  updateWorkPath,
  deleteWorkPath,
} from '../lib/sanityData'
import { APPLY_WHEN_OPTIONS, applyWhenLabel } from '../lib/workflowApplyRules'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { Route, Plus, Pencil, Trash2, Loader2, X, GripVertical } from 'lucide-react'

function emptyStep() {
  return { _key: `n${Date.now()}${Math.random().toString(36).slice(2, 7)}`, title: '', role_id: '', assignee_profile_id: '' }
}

export function WorkPaths() {
  const { hasPermission, isSuperAdmin } = useAuth()
  const { addNotification } = useNotification()
  const [paths, setPaths] = useState([])
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const canManage = hasPermission('workflows:manage') || hasPermission('roles:manage') || isSuperAdmin()

  useEffect(() => {
    if (!canManage) return
    load()
  }, [canManage])

  async function load() {
    setLoading(true)
    try {
      const [p, r, u] = await Promise.all([fetchAllWorkPaths(), fetchAllRoles(), fetchAllUserProfiles()])
      setPaths(p || [])
      setRoles(r || [])
      setUsers(u || [])
    } catch (e) {
      addNotification(e.message || 'Failed to load work paths', 'error')
    } finally {
      setLoading(false)
    }
  }

  const usersByRole = useMemo(() => {
    const m = new Map()
    for (const role of roles || []) {
      m.set(role.id, [])
    }
    for (const u of users || []) {
      const rid = u.role_id || u.role?.id || u.role?._id
      if (!rid) continue
      if (!m.has(rid)) m.set(rid, [])
      m.get(rid).push(u)
    }
    return m
  }, [roles, users])

  if (!canManage) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to manage work paths.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Route className="w-6 h-6 text-amber-500" />
            Work paths
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Multi-step prep workflows: each step has a role and a specific assignee. Apply a path on a vehicle to
            track handoffs automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setModal({
              id: null,
              name: '',
              description: '',
              apply_when: 'always',
              allow_step_overlap: false,
              steps: [emptyStep(), emptyStep()],
            })
          }
          className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-[15px] transition"
        >
          <Plus className="w-5 h-5" />
          New work path
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-amber-500/80 animate-spin mb-3" />
          <p className="text-zinc-500 text-sm">Loading…</p>
        </div>
      ) : paths.length === 0 ? (
        <p className="text-zinc-500 text-sm py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
          No work paths yet. Create one to use on vehicles.
        </p>
      ) : (
        <div className="space-y-3">
          {paths.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-3 p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{p.name}</p>
                  {p.apply_when && p.apply_when !== 'always' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/30">
                      {applyWhenLabel(p.apply_when)}
                    </span>
                  )}
                  {p.allow_step_overlap === true && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30">
                      Parallel
                    </span>
                  )}
                </div>
                {p.description ? <p className="text-sm text-zinc-500 mt-1">{p.description}</p> : null}
                <ol className="mt-3 space-y-1.5 text-sm text-zinc-400 list-decimal list-inside">
                  {(p.steps || []).map((s) => (
                    <li key={s._key}>
                      <span className="text-zinc-300">{s.title}</span>
                      <span className="text-zinc-600">
                        {' '}
                        · {s.role?.name?.replace(/_/g, ' ') || '—'}
                        {s.assignee
                          ? ` · ${s.assignee.display_name || s.assignee.email || s.assignee.firebase_uid}`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      id: p.id,
                      name: p.name || '',
                      description: p.description || '',
                      apply_when: p.apply_when || 'always',
                      allow_step_overlap: p.allow_step_overlap === true,
                      steps: (p.steps || []).map((s) => ({
                        _key: s._key,
                        title: s.title || '',
                        role_id: s.role_id || s.role?._id || '',
                        assignee_profile_id: s.assignee_id || s.assignee?._id || '',
                      })),
                    })
                  }
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  aria-label="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(p.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <WorkPathModal
          key={modal.id ?? 'create'}
          initial={modal}
          roles={roles}
          usersByRole={usersByRole}
          allUsers={users}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            load()
          }}
          addNotification={addNotification}
        />
      )}

      {deleteId && (
        <DeleteWorkPathModal
          id={deleteId}
          onClose={() => setDeleteId(null)}
          onDone={() => {
            setDeleteId(null)
            load()
          }}
          addNotification={addNotification}
        />
      )}
    </div>
  )
}

function WorkPathModal({ initial, roles, usersByRole, allUsers, onClose, onSaved, addNotification }) {
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [applyWhen, setApplyWhen] = useState(initial.apply_when || 'always')
  const [allowStepOverlap, setAllowStepOverlap] = useState(initial.allow_step_overlap === true)
  const [steps, setSteps] = useState(initial.steps?.length ? initial.steps : [emptyStep()])
  const [saving, setSaving] = useState(false)

  function assigneeOptionsForRole(roleId) {
    if (!roleId) return allUsers || []
    const list = usersByRole.get(roleId) || []
    const superAdmins = (allUsers || []).filter((u) => u.role?.name === 'super_admin')
    const merged = [...list]
    for (const u of superAdmins) {
      if (!merged.some((m) => m.id === u.id)) merged.push(u)
    }
    return merged
  }

  function updateStep(i, patch) {
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()])
  }

  function removeStep(i) {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      addNotification('Name is required', 'error')
      return
    }
    for (const s of steps) {
      if (!s.title?.trim() || !s.role_id || !s.assignee_profile_id) {
        addNotification('Each step needs title, role, and assignee', 'error')
        return
      }
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        apply_when: applyWhen,
        allow_step_overlap: allowStepOverlap,
        steps: steps.map((s) => ({
          _key: s._key,
          title: s.title.trim(),
          role_id: s.role_id,
          assignee_profile_id: s.assignee_profile_id,
        })),
      }
      if (initial.id) {
        await updateWorkPath(initial.id, payload)
        addNotification('Work path updated', 'success')
      } else {
        await createWorkPath(payload)
        addNotification('Work path created', 'success')
      }
      onSaved()
    } catch (err) {
      addNotification(err.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-2xl border border-zinc-700/80 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-zinc-700/80">
          <h3 className="text-lg font-semibold text-white">{initial.id ? 'Edit work path' : 'New work path'}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white"
              placeholder="e.g. Wash & PDI"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1.5">
              When can this path be assigned?
            </label>
            <select
              value={applyWhen}
              onChange={(e) => setApplyWhen(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              {APPLY_WHEN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-600 mt-1.5 leading-relaxed">
              Optional guardrail: e.g. prep flows only after reservation, or only while the car is still listed.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-3">
            <input
              type="checkbox"
              checked={allowStepOverlap}
              onChange={(e) => setAllowStepOverlap(e.target.checked)}
              className="mt-0.5 accent-amber-500"
            />
            <span>
              <span className="block text-sm text-zinc-200 font-medium">Steps can overlap (parallel)</span>
              <span className="block text-[11px] text-zinc-500 mt-1 leading-relaxed">
                When on, every assignee may start and finish their step anytime before the path deadline (not only one
                step at a time). When off, steps run in order as today.
              </span>
            </span>
          </label>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-zinc-500 uppercase">Steps (in order)</span>
              <button type="button" onClick={addStep} className="text-xs text-amber-400 hover:text-amber-300">
                + Add step
              </button>
            </div>
            {steps.map((s, i) => {
              const options = assigneeOptionsForRole(s.role_id)
              return (
                <div key={s._key} className="p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/60 space-y-2">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <GripVertical className="w-4 h-4" />
                    <span className="text-xs font-medium">Step {i + 1}</span>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="ml-auto text-xs text-red-400/90 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    value={s.title}
                    onChange={(e) => updateStep(i, { title: e.target.value })}
                    placeholder="Step name (e.g. Service bay)"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm"
                  />
                  <select
                    value={s.role_id}
                    onChange={(e) =>
                      updateStep(i, { role_id: e.target.value, assignee_profile_id: '' })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm"
                  >
                    <option value="">Role for this step…</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name?.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <select
                    value={s.assignee_profile_id}
                    onChange={(e) => updateStep(i, { assignee_profile_id: e.target.value })}
                    disabled={!s.role_id}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm disabled:opacity-50"
                  >
                    <option value="">Assign to…</option>
                    {options.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name || u.email}
                        {u.role?.name === 'super_admin' && s.role_id && (usersByRole.get(s.role_id) || []).every((x) => x.id !== u.id)
                          ? ' (super admin)'
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteWorkPathModal({ id, onClose, onDone, addNotification }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-medium">Delete this work path?</p>
        <p className="text-sm text-zinc-500 mt-2">Vehicles already using it keep their snapshot; the template will be removed.</p>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-600 text-zinc-300">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await deleteWorkPath(id)
                addNotification('Work path deleted', 'success')
                onDone()
              } catch (e) {
                addNotification(e.message || 'Delete failed', 'error')
              } finally {
                setBusy(false)
              }
            }}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
