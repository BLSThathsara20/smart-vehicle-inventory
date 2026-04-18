import { useEffect, useMemo, useState } from 'react'
import {
  removeVehicleWorkPathInstance,
  completeVehicleWorkPathStep,
  addWorkPathDiscussionMessage,
  getWorkflowDeadlineVisual,
  startWorkPathTimeSession,
  endWorkPathTimeSession,
  workflowInstanceStepKey,
} from '../lib/sanityData'
import { useNotification } from '../context/NotificationContext'
import { getParticipantPalette } from '../lib/workflowParticipantColors'
import { setInstanceDiscussionSeen } from '../lib/workflowBellState'
import {
  formatDurationMs,
  findOpenSessionForUser,
  findOpenSessionForUserOnStep,
  totalTrackedMsForInstance,
  totalTrackedMsAt,
  sessionDurationMs,
} from '../lib/workflowTime'
import { applyWhenLabel } from '../lib/workflowApplyRules'
import {
  Loader2,
  CheckCircle,
  Circle,
  ChevronRight,
  MessageCircle,
  Users,
  User,
  Timer,
} from 'lucide-react'

function formatDt(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function stepCompletionMap(completedSteps) {
  const m = new Map()
  for (const c of completedSteps || []) {
    if (c.step_key) m.set(c.step_key, c)
  }
  return m
}

export function buildParticipantsFromInstance(inst) {
  const steps = inst?.steps || []
  const map = new Map()
  for (const s of steps) {
    const uid = s.assignee_uid
    if (!uid) continue
    if (!map.has(uid)) {
      map.set(uid, { uid, name: s.assignee_name || uid })
    }
  }
  return [...map.values()]
}

/** Thread root for reply inheritance (direct messages). */
function findDiscussionRoot(discussion, startKey) {
  const byKey = new Map((discussion || []).map((m) => [m._key, m]))
  let k = startKey
  const seen = new Set()
  while (k && !seen.has(k)) {
    seen.add(k)
    const m = byKey.get(k)
    if (!m) return null
    if (!m.parent_key) return m
    k = m.parent_key
  }
  return null
}

function messageVisible(msg, byKey, currentUid) {
  const vis = msg.visibility === 'direct' ? 'direct' : 'all'
  if (msg.parent_key) {
    const parent = byKey.get(msg.parent_key)
    if (parent) return messageVisible(parent, byKey, currentUid)
  }
  if (vis !== 'direct') return true
  const t = msg.target_uid
  return t === currentUid || msg.author_uid === currentUid
}

function DiscussionThread({ discussion, currentUid, canPost, onReply }) {
  const byKey = useMemo(() => {
    const m = new Map()
    for (const x of discussion || []) m.set(x._key, x)
    return m
  }, [discussion])

  const roots = (discussion || []).filter((m) => !m.parent_key && messageVisible(m, byKey, currentUid))

  const byParent = new Map()
  for (const m of discussion || []) {
    if (!m.parent_key) continue
    if (!byParent.has(m.parent_key)) byParent.set(m.parent_key, [])
    byParent.get(m.parent_key).push(m)
  }

  function Msg({ msg, depth }) {
    const palette = getParticipantPalette(msg.author_uid)
    const vis = msg.visibility === 'direct' ? 'direct' : 'all'
    const replies = (byParent.get(msg._key) || []).filter((r) => messageVisible(r, byKey, currentUid))
    return (
      <div
        className={`rounded-lg overflow-hidden ${depth ? 'ml-3 mt-2 pl-3' : ''}`}
        style={
          depth
            ? { borderLeft: `2px solid ${palette.border}` }
            : {
                borderLeft: `3px solid ${palette.accent}`,
                backgroundColor: palette.soft,
                border: `1px solid ${palette.border}`,
              }
        }
      >
        <div className={`px-3 py-2 ${depth ? 'bg-zinc-900/40' : ''}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: palette.soft, color: palette.text, border: `1px solid ${palette.border}` }}
            >
              {(msg.author_name || msg.author_uid || '?').slice(0, 24)}
            </span>
            <span className="text-[10px] text-zinc-500">{formatDt(msg.created_at)}</span>
            {vis === 'direct' && msg.target_name && (
              <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                <User className="w-3 h-3 shrink-0" />
                <span>
                  To: <span style={{ color: palette.text }}>{msg.target_name}</span>
                </span>
              </span>
            )}
            {vis === 'direct' && !msg.target_name && msg.target_uid && (
              <span className="text-[10px] text-zinc-500">Direct message</span>
            )}
          </div>
          <p className="text-sm text-zinc-100 mt-1.5 whitespace-pre-wrap">{msg.body}</p>
          {canPost && currentUid && (
            <button
              type="button"
              onClick={() => onReply(msg._key)}
              className="text-[10px] text-amber-500/90 hover:text-amber-400 mt-1"
            >
              Reply
            </button>
          )}
          {replies.map((r) => (
            <Msg key={r._key} msg={r} depth />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {roots.length === 0 ? <p className="text-xs text-zinc-600">No messages yet.</p> : null}
      {roots.map((msg) => (
        <Msg key={msg._key} msg={msg} depth={0} />
      ))}
    </div>
  )
}

/**
 * Full work-path instance UI: steps, complete, discussion, remove.
 */
export function WorkPathInstancePanel({
  inst,
  vehicleId,
  vehicleSold,
  currentUid,
  currentDisplayName,
  canApply,
  canManageWorkflows,
  isSuperAdminUser = false,
  showApplyBlock,
  onUpdate,
  /** Hide admin remove (e.g. work-only view) */
  hideRemove = false,
}) {
  const { addNotification } = useNotification()
  const [busy, setBusy] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentAudience, setCommentAudience] = useState('all')
  const [commentTargetUid, setCommentTargetUid] = useState('')
  const [tick, setTick] = useState(0)

  const participants = useMemo(() => buildParticipantsFromInstance(inst), [inst])

  const replyThreadRoot = useMemo(() => {
    if (!replyTo) return null
    return findDiscussionRoot(inst.discussion, replyTo)
  }, [replyTo, inst.discussion])

  const audienceLocked =
    !!replyThreadRoot && replyThreadRoot.visibility === 'direct' && !!replyThreadRoot.target_uid

  const openTimer = useMemo(() => findOpenSessionForUser(inst, currentUid), [inst, currentUid])

  const completedKeySet = useMemo(() => {
    const m = new Set()
    for (const c of inst.completed_steps || []) {
      if (c.step_key) m.add(c.step_key)
    }
    return m
  }, [inst.completed_steps])
  const totalCompletedMs = useMemo(() => totalTrackedMsForInstance(inst, false), [inst])
  const totalIncludingLiveMs = useMemo(() => {
    void tick
    return totalTrackedMsAt(inst, Date.now())
  }, [inst, tick])

  useEffect(() => {
    if (!openTimer) return undefined
    const id = window.setInterval(() => setTick((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [openTimer?._key, openTimer?.started_at])

  useEffect(() => {
    if (vehicleId && inst?.instance_id) {
      setInstanceDiscussionSeen(vehicleId, inst.instance_id)
    }
  }, [vehicleId, inst?.instance_id])

  const vis = useMemo(() => getWorkflowDeadlineVisual(inst), [inst])

  const visCls =
    vis.tone === 'overdue'
      ? 'bg-red-500/15 text-red-400 border-red-500/35'
      : vis.tone === 'due_soon'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/35'
        : vis.tone === 'urgent'
          ? 'bg-orange-500/15 text-orange-300 border-orange-500/35'
          : vis.tone === 'deadline'
            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
            : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50'

  const steps = inst.steps || []
  const idx = Number(inst.current_step_index) || 0
  const done = inst.status === 'done'
  const active = inst.status === 'active'
  const parallel = inst.allow_step_overlap === true
  const currentStep = active && !done && !parallel && idx < steps.length ? steps[idx] : null
  const sequentialStepKey = currentStep != null ? workflowInstanceStepKey(steps, idx) : null
  const completedMap = stepCompletionMap(inst.completed_steps)
  const canPostDiscussion = !!currentUid

  const canRemoveWorkPath =
    canApply &&
    showApplyBlock &&
    !hideRemove &&
    (isSuperAdminUser ||
      canManageWorkflows ||
      (!!inst.applied_by_uid && inst.applied_by_uid === currentUid))

  async function handleRemoveInstance() {
    if (!vehicleId || !confirm('Remove this work path from the vehicle?')) return
    setBusy(true)
    try {
      await removeVehicleWorkPathInstance(vehicleId, inst.instance_id)
      addNotification('Work path removed', 'success')
      onUpdate?.()
    } catch (e) {
      addNotification(e.message || 'Could not remove', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleCompleteStep(override, stepKey) {
    if (!vehicleId || !currentUid || vehicleSold) return
    const sk = stepKey || sequentialStepKey
    if (!sk) return
    setBusy(true)
    try {
      await completeVehicleWorkPathStep(vehicleId, inst.instance_id, currentUid, { override, step_key: sk })
      addNotification('Step marked complete', 'success')
      onUpdate?.()
    } catch (e) {
      addNotification(e.message || 'Could not complete step', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function submitComment() {
    if (!commentDraft.trim() || !vehicleId || !currentUid) return
    let effectiveAudience = commentAudience
    let effectiveTargetUid = commentAudience === 'direct' ? commentTargetUid : ''
    if (replyTo) {
      const root = findDiscussionRoot(inst.discussion, replyTo)
      if (root && root.visibility === 'direct' && root.target_uid) {
        effectiveAudience = 'direct'
        effectiveTargetUid = root.target_uid
      }
    }
    if (effectiveAudience === 'direct' && !effectiveTargetUid) {
      addNotification('Choose who should see this message', 'error')
      return
    }
    const target = participants.find((p) => p.uid === effectiveTargetUid)
    let targetName = target?.name || null
    if (effectiveAudience === 'direct' && !targetName && replyTo) {
      const root = findDiscussionRoot(inst.discussion, replyTo)
      if (root?.target_uid === effectiveTargetUid) targetName = root.target_name || null
    }
    setBusy(true)
    try {
      await addWorkPathDiscussionMessage(vehicleId, inst.instance_id, {
        author_uid: currentUid,
        author_name: currentDisplayName || '',
        body: commentDraft,
        parent_key: replyTo,
        visibility: effectiveAudience === 'direct' ? 'direct' : 'all',
        target_uid: effectiveAudience === 'direct' ? effectiveTargetUid : null,
        target_name: effectiveAudience === 'direct' ? targetName : null,
      })
      addNotification('Posted', 'success')
      setCommentDraft('')
      setReplyTo(null)
      setCommentAudience('all')
      setCommentTargetUid('')
      onUpdate?.()
    } catch (e) {
      addNotification(e.message || 'Could not post', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleStartWork(stepKey) {
    if (!vehicleId || !currentUid || vehicleSold) return
    const sk = stepKey || sequentialStepKey
    if (!sk) return
    setBusy(true)
    try {
      await startWorkPathTimeSession(vehicleId, inst.instance_id, {
        user_uid: currentUid,
        user_display_name: currentDisplayName || '',
        step_key: sk,
      })
      addNotification('Work started — timer running', 'success')
      onUpdate?.()
    } catch (e) {
      addNotification(e.message || 'Could not start work', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDoneMyWork(stepKey) {
    if (!vehicleId || !currentUid || vehicleSold) return
    const sk = stepKey || sequentialStepKey
    if (!sk) return
    setBusy(true)
    try {
      try {
        await endWorkPathTimeSession(vehicleId, inst.instance_id, currentUid, sk)
      } catch (e) {
        if (!String(e.message || '').includes('No active timer')) throw e
      }
      await completeVehicleWorkPathStep(vehicleId, inst.instance_id, currentUid, {
        override: false,
        step_key: sk,
      })
      addNotification('Step completed', 'success')
      onUpdate?.()
    } catch (e) {
      addNotification(e.message || 'Could not finish step', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800/60 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-amber-400/90 text-sm flex-1 min-w-0">{inst.template_name}</p>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {vis.label ? (
              <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium uppercase ${visCls}`}>
                {vis.label}
              </span>
            ) : null}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md border ${
                done ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              {done ? 'Done' : active ? 'Active' : inst.status}
            </span>
          </div>
          {canRemoveWorkPath && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRemoveInstance}
              className="text-[10px] text-zinc-500 hover:text-red-400 underline shrink-0"
            >
              Remove work path
            </button>
          )}
        </div>
        {inst.applied_by_name && (
          <p className="text-[10px] text-zinc-500">
            Applied by <span className="text-zinc-400">{inst.applied_by_name}</span>
          </p>
        )}
        {inst.apply_when && inst.apply_when !== 'always' && (
          <p className="text-[10px] text-zinc-500">
            Template gate: <span className="text-zinc-400">{applyWhenLabel(inst.apply_when)}</span>
          </p>
        )}
      </div>

      {/* Participant legend */}
      {participants.length > 0 && (
        <div className="px-3 py-2 border-b border-zinc-800/40 flex flex-wrap gap-2 items-center bg-zinc-900/80">
          <span className="text-[10px] text-zinc-500 uppercase shrink-0">People</span>
          {participants.map((p) => {
            const pal = getParticipantPalette(p.uid)
            return (
              <span
                key={p.uid}
                className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                style={{
                  backgroundColor: pal.soft,
                  color: pal.text,
                  border: `1px solid ${pal.border}`,
                }}
                title={p.uid}
              >
                {p.name}
              </span>
            )
          })}
        </div>
      )}

      <div className="p-3 space-y-2 text-xs text-zinc-500">
        <p>
          Started {formatDt(inst.started_at)}
          {inst.deadline_at && <> · Deadline {formatDt(inst.deadline_at)}</>}
        </p>
        {active && parallel ? (
          <p className="text-zinc-400">
            <span className="text-zinc-200 font-medium">Parallel path</span> — assignees can work their steps in any
            order before the deadline.
          </p>
        ) : null}
        {active && currentStep ? (
          <p>
            <span className="text-zinc-400">Now:</span>{' '}
            <span className="text-zinc-200 font-medium">{currentStep.title}</span> —{' '}
            <span style={{ color: getParticipantPalette(currentStep.assignee_uid).text }}>
              {currentStep.assignee_name || currentStep.assignee_uid}
            </span>
            {inst.current_step_started_at && <> · step started {formatDt(inst.current_step_started_at)}</>}
          </p>
        ) : null}
      </div>

      <ol className="px-3 pb-3 space-y-2">
        {steps.map((s, i) => {
          const sk = workflowInstanceStepKey(steps, i)
          const isStepDone = done || completedKeySet.has(sk)
          const isSequentialCurrent = active && !done && !parallel && i === idx
          const isParallelOpen = parallel && active && !isStepDone
          const rec = completedMap.get(sk)
          const pal = getParticipantPalette(s.assignee_uid)
          const rowTimer =
            parallel && currentUid ? findOpenSessionForUserOnStep(inst, currentUid, sk) : null
          return (
            <li
              key={s._key || sk || i}
              className={`flex gap-3 p-3 rounded-xl border text-sm transition ${
                isSequentialCurrent
                  ? 'shadow-lg'
                  : isParallelOpen
                    ? 'border-zinc-700/70 bg-zinc-900/45 text-zinc-300'
                    : isStepDone
                      ? 'border-zinc-700/50 bg-zinc-800/30 text-zinc-400'
                      : 'border-zinc-800/60 bg-zinc-900/30 text-zinc-500'
              }`}
              style={
                isSequentialCurrent
                  ? {
                      borderColor: pal.border,
                      backgroundColor: pal.soft,
                      boxShadow: `0 0 0 1px ${pal.glow}`,
                    }
                  : isParallelOpen
                    ? { borderLeft: `3px solid ${pal.accent}` }
                    : isStepDone
                      ? { borderLeft: `3px solid ${pal.accent}`, opacity: 0.92 }
                      : { borderLeft: `3px solid ${pal.border}` }
              }
            >
              <span className="shrink-0 mt-0.5">
                {isStepDone ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : isSequentialCurrent || isParallelOpen ? (
                  <ChevronRight className="w-4 h-4" style={{ color: pal.accent }} />
                ) : (
                  <Circle className="w-4 h-4 text-zinc-600" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{s.title}</p>
                <p className="text-xs mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-zinc-500">{s.role_name?.replace(/_/g, ' ') || '—'}</span>
                  <span
                    className="font-medium px-1.5 py-0.5 rounded text-[11px]"
                    style={{ backgroundColor: pal.soft, color: pal.text, border: `1px solid ${pal.border}` }}
                  >
                    {s.assignee_name || s.assignee_uid}
                  </span>
                </p>
                {isStepDone && rec && (
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Started {formatDt(rec.started_at)} · Done {formatDt(rec.completed_at)}
                  </p>
                )}
                {parallel && active && !isStepDone && !vehicleSold && (
                  <div className="mt-2 space-y-1.5">
                    {currentUid === s.assignee_uid ? (
                      <>
                        {rowTimer ? (
                          <p className="text-[10px] text-zinc-500">
                            On the clock{' '}
                            <span className="font-mono text-amber-400/95 tabular-nums">
                              {formatDurationMs(sessionDurationMs(rowTimer))}
                            </span>
                            <span className="block text-zinc-600 mt-0.5">
                              Since {formatDt(rowTimer.started_at)}
                            </span>
                          </p>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => (rowTimer ? handleDoneMyWork(sk) : handleStartWork(sk))}
                          className="w-full py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50"
                        >
                          {busy ? '…' : rowTimer ? 'Done my work' : 'Start work'}
                        </button>
                      </>
                    ) : canManageWorkflows ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleCompleteStep(true, sk)}
                        className="w-full py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50"
                      >
                        {busy ? '…' : 'Mark step done (admin)'}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {active && currentStep && (
        <div className="px-3 pb-3 space-y-2">
          {currentUid === currentStep.assignee_uid && !vehicleSold ? (
            <>
              {openTimer ? (
                <p className="text-center text-xs text-zinc-500">
                  On the clock{' '}
                  <span className="font-mono text-amber-400/95 tabular-nums">
                    {formatDurationMs(sessionDurationMs(openTimer))}
                  </span>
                  <span className="block text-[10px] text-zinc-600 mt-0.5">
                    Since {formatDt(openTimer.started_at)}
                  </span>
                </p>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={openTimer ? () => handleDoneMyWork(sequentialStepKey) : () => handleStartWork(sequentialStepKey)}
                className="w-full py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? '…' : openTimer ? 'Done my work' : 'Start work'}
              </button>
            </>
          ) : currentUid === currentStep.assignee_uid && vehicleSold ? (
            <p className="text-xs text-zinc-500 text-center py-2">Work path is read-only — vehicle sold.</p>
          ) : canManageWorkflows && currentStep.assignee_uid !== currentUid && !vehicleSold ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleCompleteStep(true, sequentialStepKey)}
              className="w-full py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? '…' : 'Mark step done (admin)'}
            </button>
          ) : (
            <p className="text-xs text-zinc-500 text-center py-2">
              Waiting for{' '}
              <span style={{ color: getParticipantPalette(currentStep.assignee_uid).text }}>
                {currentStep.assignee_name}
              </span>
              .
            </p>
          )}
        </div>
      )}

      <div className="px-3 pb-3 border-t border-zinc-800/50 pt-3 space-y-1">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
          <Timer className="w-3 h-3" />
          Time on this path
        </p>
        <p className="text-xs text-zinc-400">
          Logged work (completed timers):{' '}
          <span className="text-amber-400/90 font-medium tabular-nums">{formatDurationMs(totalCompletedMs)}</span>
          {openTimer ? (
            <>
              {' '}
              · with active run:{' '}
              <span className="text-sky-400/90 font-medium tabular-nums">{formatDurationMs(totalIncludingLiveMs)}</span>
            </>
          ) : null}
        </p>
        {inst.finished_at && inst.started_at ? (
          <p className="text-[11px] text-zinc-600">
            Calendar span (start → done):{' '}
            <span className="text-zinc-400 tabular-nums">
              {formatDurationMs(new Date(inst.finished_at) - new Date(inst.started_at))}
            </span>
          </p>
        ) : inst.started_at ? (
          <p className="text-[11px] text-zinc-600">Path started {formatDt(inst.started_at)}</p>
        ) : null}
      </div>

      <div className="px-3 pb-3 border-t border-zinc-800/60 pt-3">
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-2">
          <MessageCircle className="w-3.5 h-3.5" />
          Requests & comments
        </div>
        <DiscussionThread
          discussion={inst.discussion}
          currentUid={currentUid}
          canPost={canPostDiscussion}
          onReply={(parentKey) => {
            setReplyTo(parentKey)
            setCommentDraft('')
          }}
        />
        {canPostDiscussion && (
          <div className="mt-3 space-y-2">
            {replyTo && (
              <p className="text-[10px] text-zinc-500">
                Replying in thread
                {audienceLocked && (
                  <>
                    {' '}
                    (direct — same recipient as the root message)
                  </>
                )}
                .
              </p>
            )}
            {audienceLocked ? (
              <p className="text-[11px] text-zinc-500">
                Visible only to participants in this direct thread (you and{' '}
                <span className="text-zinc-400">{replyThreadRoot.target_name || replyThreadRoot.target_uid}</span>
                ).
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 items-center text-[11px]">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Visible to:
                  </span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`aud-${inst.instance_id}`}
                      checked={commentAudience === 'all'}
                      onChange={() => {
                        setCommentAudience('all')
                        setCommentTargetUid('')
                      }}
                      className="accent-amber-500"
                    />
                    <span className="text-zinc-300">Everyone</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`aud-${inst.instance_id}`}
                      checked={commentAudience === 'direct'}
                      onChange={() => setCommentAudience('direct')}
                      className="accent-amber-500"
                    />
                    <span className="text-zinc-300">One person</span>
                  </label>
                </div>
                {commentAudience === 'direct' && (
                  <select
                    value={commentTargetUid}
                    onChange={(e) => setCommentTargetUid(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
                  >
                    <option value="">Select person…</option>
                    {participants.map((p) => (
                      <option key={p.uid} value={p.uid}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder={
                audienceLocked || commentAudience === 'direct'
                  ? 'Message for the selected person…'
                  : 'Add a note for everyone on this path…'
              }
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm resize-none"
            />
            <div className="flex gap-2 flex-wrap items-center">
              <button
                type="button"
                disabled={busy || !commentDraft.trim()}
                onClick={submitComment}
                className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Post'}
              </button>
              {replyTo && (
                <button type="button" onClick={() => setReplyTo(null)} className="text-xs text-zinc-500 underline">
                  Cancel reply
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
