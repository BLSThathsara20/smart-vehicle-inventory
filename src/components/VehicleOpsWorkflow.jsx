import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchWorkPathTemplatesList,
  applyWorkPathToVehicle,
  normalizeVehicleWorkflowInstances,
  getWorkflowDeadlineVisual,
  workflowInstanceStepKey,
} from '../lib/sanityData'
import { getParticipantPalette } from '../lib/workflowParticipantColors'
import { vehicleMeetsApplyWhen } from '../lib/workflowApplyRules'
import { WorkPathInstancePanel } from './WorkPathInstancePanel'
import { useNotification } from '../context/NotificationContext'
import { Route, Loader2, ChevronRight, X, ExternalLink } from 'lucide-react'

function formatDt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function WorkPathApplySkeleton() {
  return (
    <div
      className="space-y-3 p-3 rounded-xl bg-zinc-800/20 border border-zinc-800/80 animate-pulse"
      aria-busy="true"
      aria-label="Loading work path templates"
    >
      <div className="h-3 w-40 rounded bg-zinc-700/80" />
      <div className="h-10 w-full rounded-xl bg-zinc-800/90" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="h-10 rounded-xl bg-zinc-800/90" />
        <div className="h-10 rounded-xl bg-zinc-800/90" />
      </div>
      <div className="h-10 w-32 rounded-xl bg-zinc-700/70" />
    </div>
  )
}

export function VehicleOpsWorkflow({
  vehicle,
  currentUid,
  currentDisplayName,
  onUpdate,
  canApply,
  canManageWorkflows,
}) {
  const { addNotification } = useNotification()
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [deadlineLocal, setDeadlineLocal] = useState('')
  const [priority, setPriority] = useState('normal')
  const [busy, setBusy] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setTemplatesLoading(true)
    fetchWorkPathTemplatesList()
      .then((list) => {
        if (!cancelled) setTemplates(list || [])
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const instances = useMemo(() => {
    const raw = normalizeVehicleWorkflowInstances(vehicle)
    return [...raw].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
  }, [vehicle])

  const primaryInstance = instances[0] || null
  const hasWorkPath = !!primaryInstance

  useEffect(() => {
    if (!hasWorkPath) setDetailOpen(false)
  }, [hasWorkPath])

  async function handleApply() {
    if (!selectedTemplate || !vehicle?.id) return
    const tpl = templates.find((t) => t.id === selectedTemplate)
    const gate = tpl?.apply_when || 'always'
    const check = vehicleMeetsApplyWhen(vehicle, gate)
    if (!check.ok) {
      addNotification(check.message, 'error')
      return
    }
    setBusy(true)
    try {
      let deadlineAt = null
      if (deadlineLocal) {
        const d = new Date(deadlineLocal)
        if (!Number.isNaN(d.getTime())) deadlineAt = d.toISOString()
      }
      await applyWorkPathToVehicle(vehicle.id, selectedTemplate, {
        deadlineAt,
        priority: priority === 'urgent' ? 'urgent' : 'normal',
      })
      addNotification('Work path applied', 'success')
      setSelectedTemplate('')
      setDeadlineLocal('')
      setPriority('normal')
      onUpdate?.()
    } catch (e) {
      addNotification(e.message || 'Could not apply work path', 'error')
    } finally {
      setBusy(false)
    }
  }

  const showApplyBlock = canApply && !vehicle?.sold

  const overviewVis = primaryInstance ? getWorkflowDeadlineVisual(primaryInstance) : null
  const overviewVisCls = overviewVis
    ? overviewVis.tone === 'overdue'
      ? 'border-red-500/30 bg-red-500/5'
      : overviewVis.tone === 'due_soon'
        ? 'border-amber-500/35 bg-amber-500/5'
        : overviewVis.tone === 'urgent'
          ? 'border-orange-500/35 bg-orange-500/5'
          : 'border-zinc-700/60 bg-zinc-800/30'
    : ''

  const steps = primaryInstance?.steps || []
  const idx = Number(primaryInstance?.current_step_index) || 0
  const done = primaryInstance?.status === 'done'
  const active = primaryInstance?.status === 'active'
  const parallel = primaryInstance?.allow_step_overlap === true

  const completedStepKeys = useMemo(() => {
    const m = new Set()
    for (const c of primaryInstance?.completed_steps || []) {
      if (c.step_key) m.add(c.step_key)
    }
    return m
  }, [primaryInstance?.completed_steps])

  const completedCount = useMemo(() => {
    if (!steps.length) return 0
    return steps.filter((_, i) => completedStepKeys.has(workflowInstanceStepKey(steps, i))).length
  }, [steps, completedStepKeys])

  const currentStep =
    primaryInstance && active && !parallel && idx < steps.length ? steps[idx] : null
  const firstOpenStep = useMemo(() => {
    if (!primaryInstance || done || !steps.length || !parallel) return null
    return (
      steps.find((_, i) => !completedStepKeys.has(workflowInstanceStepKey(steps, i))) || null
    )
  }, [primaryInstance, done, steps, completedStepKeys, parallel])

  const overviewAssigneeStep = parallel ? firstOpenStep : currentStep
  const assigneePal = overviewAssigneeStep
    ? getParticipantPalette(overviewAssigneeStep.assignee_uid)
    : null

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
        <Route className="w-4 h-4 text-amber-500/90" />
        <h3 className="font-semibold text-white text-sm">Prep work path</h3>
      </div>
      <div className="p-4 space-y-4">
        {showApplyBlock && templatesLoading && <WorkPathApplySkeleton />}

        {!templatesLoading && templates.length === 0 && showApplyBlock && !hasWorkPath && (
          <p className="text-xs text-amber-500/80">
            No saved templates found. Create one under <span className="font-medium">Work paths</span> in the sidebar.
          </p>
        )}

        {showApplyBlock && !templatesLoading && templates.length > 0 && !hasWorkPath && (
          <div className="space-y-3 p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/50">
            <p className="text-xs text-zinc-500">Assign one work path to this vehicle (only one at a time).</p>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm"
            >
              <option value="">Choose work path…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  value={deadlineLocal}
                  onChange={(e) => setDeadlineLocal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              disabled={busy || !selectedTemplate}
              onClick={handleApply}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Apply to vehicle'}
            </button>
          </div>
        )}

        {!hasWorkPath && !showApplyBlock && (
          <p className="text-xs text-zinc-600">Work paths can be assigned when you can edit this vehicle.</p>
        )}

        {hasWorkPath && primaryInstance && (
          <>
            {instances.length > 1 && (
              <p className="text-[11px] text-amber-500/80">
                Multiple work paths are stored on this vehicle. Overview shows the first; open details to manage. Remove
                extras in the detail view, or clear in Sanity.
              </p>
            )}
            <div className={`rounded-xl border transition ${overviewVisCls}`}>
              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="w-full text-left p-4 hover:border-amber-500/35 rounded-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-amber-400/95">{primaryInstance.template_name}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {done
                        ? 'Completed'
                        : active && steps.length
                          ? parallel
                            ? `${completedCount}/${steps.length} done · parallel`
                            : `Step ${Math.min(idx + 1, steps.length)} of ${steps.length}`
                          : primaryInstance.status}
                      {!parallel && currentStep && (
                        <>
                          {' '}
                          · <span className="text-zinc-400">Now:</span>{' '}
                          <span className="text-zinc-300">{currentStep.title}</span>
                        </>
                      )}
                      {parallel && active && steps.length > 0 && !done && (
                        <>
                          {' '}
                          · <span className="text-zinc-400">{steps.length - completedCount} open</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {overviewAssigneeStep && assigneePal && (
                        <span
                          className="inline-flex items-center gap-1.5 font-medium px-1.5 py-0 rounded-md text-[11px]"
                          style={{
                            backgroundColor: assigneePal.soft,
                            color: assigneePal.text,
                            border: `1px solid ${assigneePal.border}`,
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: assigneePal.accent }}
                            aria-hidden
                          />
                          {overviewAssigneeStep.assignee_name || overviewAssigneeStep.assignee_uid}
                        </span>
                      )}
                      {primaryInstance.deadline_at && (
                        <span>Due {formatDt(primaryInstance.deadline_at)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {overviewVis?.label && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-medium uppercase ${
                          overviewVis.tone === 'overdue'
                            ? 'bg-red-500/15 text-red-400 border-red-500/35'
                            : overviewVis.tone === 'due_soon'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/35'
                              : overviewVis.tone === 'urgent'
                                ? 'bg-orange-500/15 text-orange-300 border-orange-500/35'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {overviewVis.label}
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md border ${
                        done
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {done ? 'Done' : 'Active'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-amber-500/90 mt-1">
                      <ChevronRight className="w-3.5 h-3.5" />
                      Open details
                    </span>
                  </div>
                </div>
              </button>
              <div className="px-4 pb-4 flex flex-wrap gap-2">
                <Link
                  to={`/app/work/${vehicle.id}/${primaryInstance.instance_id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:border-amber-500/35 hover:text-amber-400/95"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  Focused task view
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {detailOpen && primaryInstance && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setDetailOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[min(90vh,640px)] flex flex-col rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
              <p className="font-semibold text-white text-sm">Work path details</p>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1 space-y-6">
              <Link
                to={`/app/work/${vehicle.id}/${primaryInstance.instance_id}`}
                onClick={() => setDetailOpen(false)}
                className="flex w-full items-center justify-center gap-2 text-sm font-medium py-2.5 rounded-xl bg-zinc-800 border border-zinc-600 text-amber-400/95 hover:border-amber-500/25"
              >
                <ExternalLink className="w-4 h-4" />
                Open focused task view
              </Link>
              {instances.length > 1
                ? instances.map((inst) => (
                    <WorkPathInstancePanel
                      key={inst.instance_id}
                      inst={inst}
                      vehicleId={vehicle?.id}
                      vehicleSold={!!vehicle?.sold}
                      currentUid={currentUid}
                      currentDisplayName={currentDisplayName}
                      canApply={canApply}
                      canManageWorkflows={canManageWorkflows}
                      showApplyBlock={showApplyBlock}
                      onUpdate={onUpdate}
                    />
                  ))
                : (
                    <WorkPathInstancePanel
                      inst={primaryInstance}
                      vehicleId={vehicle?.id}
                      vehicleSold={!!vehicle?.sold}
                      currentUid={currentUid}
                      currentDisplayName={currentDisplayName}
                      canApply={canApply}
                      canManageWorkflows={canManageWorkflows}
                      showApplyBlock={showApplyBlock}
                      onUpdate={onUpdate}
                    />
                  )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
