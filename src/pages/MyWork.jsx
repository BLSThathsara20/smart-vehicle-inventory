import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchVehiclesWithWorkflows, collectMyWorkItems, getWorkflowDeadlineVisual } from '../lib/sanityData'
import { getParticipantPalette } from '../lib/workflowParticipantColors'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { ClipboardList, Loader2, Car, ExternalLink } from 'lucide-react'

export function MyWork() {
  const { user, hasPermission } = useAuth()
  const { addNotification } = useNotification()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)

  const canView = hasPermission('inventory:view')

  useEffect(() => {
    if (!canView || !user?.uid) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const v = await fetchVehiclesWithWorkflows()
        if (!cancelled) setVehicles(v || [])
      } catch (e) {
        if (!cancelled) addNotification(e.message || 'Failed to load', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canView, user?.uid])

  const items = useMemo(() => collectMyWorkItems(vehicles, user?.uid), [vehicles, user?.uid])

  if (!canView) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to view this page.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-amber-500" />
          My work
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Active steps assigned to you across vehicles (by work path).
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-amber-500/80 animate-spin mb-3" />
          <p className="text-zinc-500 text-sm">Loading…</p>
        </div>
      ) : items.length === 0 ? (
        <p className="text-zinc-500 text-sm py-12 text-center border border-dashed border-zinc-800 rounded-2xl">
          Nothing assigned to you right now.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map(({ vehicle, instance, currentStep, stepIndex }) => {
            const vis = getWorkflowDeadlineVisual(instance)
            const cls =
              vis.tone === 'overdue'
                ? 'border-red-500/30 bg-red-500/5'
                : vis.tone === 'due_soon'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : vis.tone === 'urgent'
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : 'border-zinc-800/60 bg-zinc-900/50'
            const pal = currentStep ? getParticipantPalette(currentStep.assignee_uid) : null
            const thumb = vehicle.images?.[0]?.url
            return (
              <div
                key={`${vehicle.id}-${instance.instance_id}`}
                className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border ${cls}`}
              >
                <div className="flex gap-4 min-w-0 flex-1">
                  <div
                    className="w-14 h-14 shrink-0 rounded-xl overflow-hidden border flex items-center justify-center"
                    style={
                      pal
                        ? { borderColor: pal.border, backgroundColor: pal.soft }
                        : { borderColor: 'rgb(39 39 42)', backgroundColor: 'rgb(24 24 27)' }
                    }
                  >
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Car className="w-6 h-6 text-amber-500/80" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">
                      {vehicle.brand} {vehicle.model}
                      {vehicle.stock_id != null && vehicle.stock_id !== '' && (
                        <span className="text-zinc-500 font-normal"> · #{vehicle.stock_id}</span>
                      )}
                    </p>
                    <p className="text-sm text-amber-400/90 mt-0.5">{instance.template_name}</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      Step {stepIndex + 1}: {currentStep?.title}
                    </p>
                    {pal && currentStep && (
                      <p className="text-[11px] mt-1.5">
                        <span
                          className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: pal.soft,
                            color: pal.text,
                            border: `1px solid ${pal.border}`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pal.accent }} />
                          Your step · {currentStep.assignee_name || 'You'}
                        </span>
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {vis.label && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {vis.label}
                        </span>
                      )}
                      {instance.deadline_at && (
                        <span className="text-[10px] text-zinc-500">
                          Due{' '}
                          {new Date(instance.deadline_at).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end sm:justify-center shrink-0">
                  <Link
                    to={`/app/work/${vehicle.id}/${instance.instance_id}`}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400/95 hover:bg-amber-500/30 text-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    Open task
                  </Link>
                  <Link
                    to={`/vehicle/${vehicle.id}`}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-600 text-zinc-300 hover:border-zinc-500 text-center"
                  >
                    View vehicle
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
