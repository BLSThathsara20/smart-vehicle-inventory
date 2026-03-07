import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { RESERVATION_STEPS } from '../lib/reservationWorkflow'
import {
  Lock,
  ClipboardCheck,
  FileCheck,
  Calendar,
  Package,
  CheckCircle,
  ChevronRight,
  MessageSquare,
  Loader2,
  Send,
  ShieldCheck,
  Undo2,
} from 'lucide-react'

const ICONS = {
  Lock,
  ClipboardCheck,
  FileCheck,
  Calendar,
  Package,
  CheckCircle,
}

export function ReservationWorkflow({ vehicleId, vehicle, canEdit, onUpdate }) {
  const { user } = useAuth()
  const { addNotification } = useNotification()
  const [updates, setUpdates] = useState({})
  const [loading, setLoading] = useState(true)
  const [updatingStep, setUpdatingStep] = useState(null)
  const [comment, setComment] = useState('')
  const [activeStep, setActiveStep] = useState(null)
  const [savingDeliveryDate, setSavingDeliveryDate] = useState(false)

  useEffect(() => {
    fetchUpdates()
  }, [vehicleId])

  async function fetchUpdates() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reservation_workflow_updates')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('updated_at', { ascending: false })

      if (error) throw error

      const byStep = {}
      ;(data || []).forEach((u) => {
        if (!byStep[u.step_key]) byStep[u.step_key] = u
      })
      setUpdates(byStep)
    } catch (err) {
      addNotification(err.message || 'Failed to load workflow', 'error')
    } finally {
      setLoading(false)
    }
  }

  function getDeviceInfo() {
    if (typeof navigator === 'undefined') return null
    const ua = navigator.userAgent
    const isMobile = /Mobile|Android|iPhone/i.test(ua)
    const platform = navigator.platform || 'Unknown'
    return `${isMobile ? 'Mobile' : 'Desktop'} · ${platform}`
  }

  async function undoPdi() {
    if (!canEdit || !updates.pdi?.id) return
    setUpdatingStep('pdi_undo')
    try {
      const { error } = await supabase
        .from('reservation_workflow_updates')
        .delete()
        .eq('id', updates.pdi.id)
      if (error) throw error
      addNotification('PDI undone', 'success')
      fetchUpdates()
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Failed to undo', 'error')
    } finally {
      setUpdatingStep(null)
    }
  }

  async function managerApprovePdi() {
    if (!canEdit) return
    const step = RESERVATION_STEPS.find((s) => s.key === 'pdi_approved')
    if (!step) return
    setUpdatingStep('pdi_approved')
    try {
      const { data: profile } = await supabase.from('profiles').select('display_name, email').eq('user_id', user?.id).single()
      const updatedByName = profile?.display_name || profile?.email || 'Unknown'
      const { error } = await supabase.from('reservation_workflow_updates').insert({
        vehicle_id: vehicleId,
        step_key: step.key,
        step_label: step.label,
        status: 'done',
        comment: 'Manager approved PDI',
        updated_by: user?.id,
        updated_by_name: updatedByName,
        device_info: getDeviceInfo(),
      })
      if (error) throw error
      addNotification('PDI approved — visible to customer', 'success')
      fetchUpdates()
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Failed to approve', 'error')
    } finally {
      setUpdatingStep(null)
    }
  }

  async function managerApproveReadyToPickup() {
    if (!canEdit) return
    const readyStep = RESERVATION_STEPS.find((s) => s.key === 'ready_to_pickup')
    if (!readyStep) return
    setUpdatingStep('ready_to_pickup')
    try {
      const { data: profile } = await supabase.from('profiles').select('display_name, email').eq('user_id', user?.id).single()
      const updatedByName = profile?.display_name || profile?.email || 'Unknown'
      const { error } = await supabase.from('reservation_workflow_updates').insert({
        vehicle_id: vehicleId,
        step_key: readyStep.key,
        step_label: readyStep.label,
        status: 'done',
        comment: 'Manager approved — ready for customer pickup',
        updated_by: user?.id,
        updated_by_name: updatedByName,
        device_info: getDeviceInfo(),
      })
      if (error) throw error
      addNotification('Manager approved — Ready to pickup', 'success')
      fetchUpdates()
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Failed to approve', 'error')
    } finally {
      setUpdatingStep(null)
    }
  }

  async function saveDeliveryDate(date) {
    if (!canEdit || !vehicleId) return
    setSavingDeliveryDate(true)
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ planned_collection_date: date || null })
        .eq('id', vehicleId)
      if (error) throw error
      addNotification(date ? 'Delivery date saved' : 'Delivery date cleared', 'success')
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Failed to save date', 'error')
    } finally {
      setSavingDeliveryDate(false)
    }
  }

  async function markStepDone(step) {
    if (!canEdit) return
    setUpdatingStep(step.key)
    try {
      const { data: profile } = await supabase.from('profiles').select('display_name, email').eq('user_id', user?.id).single()
      const updatedByName = profile?.display_name || profile?.email || 'Unknown'
      const { error } = await supabase.from('reservation_workflow_updates').insert({
        vehicle_id: vehicleId,
        step_key: step.key,
        step_label: step.label,
        status: 'done',
        comment: comment.trim() || null,
        updated_by: user?.id,
        updated_by_name: updatedByName,
        device_info: getDeviceInfo(),
      })
      if (error) throw error
      addNotification(`${step.label} marked complete`, 'success')
      setComment('')
      setActiveStep(null)
      fetchUpdates()
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Failed to update', 'error')
    } finally {
      setUpdatingStep(null)
    }
  }

  const getStepStatus = (step) => {
    const u = updates[step.key]
    if (u) return { done: true, comment: u.comment, date: u.updated_at }
    if (step.key === 'reserved' && vehicle?.reserved) {
      return { done: true, comment: null, date: vehicle.reserved_date || vehicle.updated_at }
    }
    const stepIndex = RESERVATION_STEPS.findIndex((s) => s.key === step.key)
    const prevSteps = RESERVATION_STEPS.slice(0, stepIndex)
    const allPrevDone = prevSteps.every((s) => updates[s.key] || (s.key === 'reserved' && vehicle?.reserved))
    return { done: false, inProgress: allPrevDone }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-amber-500/80 animate-spin" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-500/5">
        <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Reservation workflow
        </h3>
        <p className="text-xs text-amber-400/70 mt-0.5">Track progress from reservation to handover</p>
      </div>
      <div className="divide-y divide-amber-500/10">
        {RESERVATION_STEPS.map((step, i) => {
          const Icon = ICONS[step.icon] || Lock
          const { done, comment: stepComment, date, inProgress } = getStepStatus(step)
          const isActive = activeStep === step.key

          return (
            <div key={step.key} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    done ? 'bg-emerald-500/20 text-emerald-400' : inProgress ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800/60 text-zinc-500'
                  }`}
                >
                  {done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${done ? 'text-emerald-400' : inProgress ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {step.label}
                    </span>
                    {done && (
                      <span className="text-[10px] text-zinc-500">
                        {date ? new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                      </span>
                    )}
                  </div>
                  {updates[step.key]?.updated_by_name && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      By {updates[step.key].updated_by_name}
                      {updates[step.key].device_info && ` · ${updates[step.key].device_info}`}
                    </p>
                  )}
                  {step.key === 'reserved' && vehicle?.reserved && (
                    <div className="text-[10px] text-zinc-500 mt-0.5 space-y-0.5">
                      {vehicle.reserved_date && (
                        <p>{new Date(vehicle.reserved_date).toLocaleString(undefined, { dateStyle: 'medium' })}</p>
                      )}
                      {(vehicle.customer_name || vehicle.customer_phone) && (
                        <p className="font-medium text-zinc-400">
                          {vehicle.customer_name}
                          {vehicle.customer_phone && ` · ${vehicle.customer_phone}`}
                        </p>
                      )}
                    </div>
                  )}
                  {stepComment && (
                    <p className="text-xs text-zinc-400 mt-1 flex items-start gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {stepComment}
                    </p>
                  )}
                  {step.key === 'delivery' && vehicle?.reserved && canEdit && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={vehicle.planned_collection_date || ''}
                        onChange={(e) => saveDeliveryDate(e.target.value || null)}
                        disabled={savingDeliveryDate}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-white text-sm focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
                      />
                      {savingDeliveryDate && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
                      <span className="text-[10px] text-zinc-500">Add or change delivery date anytime</span>
                    </div>
                  )}
                  {step.key === 'pdi' && done && !updates.pdi_approved && canEdit && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={managerApprovePdi}
                        disabled={updatingStep === 'pdi_approved' || updatingStep === 'pdi_undo'}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50 border border-amber-500/50"
                      >
                        {updatingStep === 'pdi_approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Manager Approve PDI
                      </button>
                      <button
                        type="button"
                        onClick={undoPdi}
                        disabled={updatingStep === 'pdi_approved' || updatingStep === 'pdi_undo'}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-600 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 text-sm font-medium disabled:opacity-50"
                      >
                        {updatingStep === 'pdi_undo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                        Undo PDI
                      </button>
                      <p className="text-[10px] text-zinc-500 mt-1 w-full">Approve before customer sees PDI complete. Undo to redo inspection.</p>
                    </div>
                  )}
                  {step.key === 'ready' && done && !updates.ready_to_pickup && canEdit && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={managerApproveReadyToPickup}
                        disabled={updatingStep === 'ready_to_pickup'}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50 border border-amber-500/50"
                      >
                        {updatingStep === 'ready_to_pickup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Manager Approve — Ready to pickup
                      </button>
                      <p className="text-[10px] text-zinc-500 mt-1">Confirm vehicle is ready for customer collection</p>
                    </div>
                  )}
                  {canEdit && !done && inProgress && !step.internalOnly && (
                    <div className="mt-2">
                      {isActive ? (
                        <div className="space-y-2">
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Add a comment (optional)"
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => markStepDone(step)}
                              disabled={updatingStep === step.key}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50"
                            >
                              {updatingStep === step.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Mark done
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveStep(null); setComment('') }}
                              className="px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-400 text-sm hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveStep(step.key)}
                          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
                        >
                          <ChevronRight className="w-4 h-4" />
                          Update status
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
