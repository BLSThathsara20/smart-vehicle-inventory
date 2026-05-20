import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  fetchVehicleById,
  fetchAllUserProfiles,
  normalizeVehicleWorkflowInstances,
  workflowInstanceStepKey,
} from '../lib/sanityData'
import { buildCollectionPackPdf } from '../lib/collectionPackPdf'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { LoadingState } from '../components/LoadingState'
import {
  ArrowLeft,
  Car,
  FileDown,
  Calendar,
  User,
  ClipboardList,
  CheckCircle2,
  Circle,
} from 'lucide-react'

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(iso)
  }
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

export function CollectionPuloutReport() {
  const { vehicleId } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { addNotification } = useNotification()
  const canView = hasPermission('inventory:view')

  const [vehicle, setVehicle] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadMessage, setLoadMessage] = useState('Loading vehicle…')
  const [exporting, setExporting] = useState(false)

  const nameByUid = useMemo(() => {
    const m = {}
    for (const p of profiles || []) {
      const uid = p.firebase_uid || p.user_id
      if (!uid) continue
      m[uid] = p.display_name || p.email || uid
    }
    return m
  }, [profiles])

  useEffect(() => {
    if (!vehicleId || !canView) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoadMessage('Loading vehicle and team directory…')
    Promise.all([fetchVehicleById(vehicleId), fetchAllUserProfiles()])
      .then(([v, plist]) => {
        if (cancelled) return
        if (!v) {
          setVehicle(null)
          return
        }
        setVehicle(v)
        setProfiles(plist || [])
      })
      .catch((e) => {
        if (!cancelled) addNotification(e.message || 'Failed to load', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vehicleId, canView, addNotification])

  function handlePdf() {
    if (!vehicle) return
    setExporting(true)
    try {
      buildCollectionPackPdf(vehicle, { nameByUid })
      addNotification('PDF downloaded', 'success')
    } catch (e) {
      addNotification(e.message || 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (!canView) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to view this report.</p>
      </div>
    )
  }

  if (loading) {
    return <LoadingState message={loadMessage} variant="embedded" className="py-24" />
  }

  if (!vehicle) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">Vehicle not found.</p>
        <button type="button" className="text-amber-500 text-sm mt-2" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    )
  }

  const instances = normalizeVehicleWorkflowInstances(vehicle)
  const reserved = vehicle.reserved && !vehicle.sold

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
            <Car className="w-7 h-7 text-amber-500 shrink-0" />
            Pulout / collection report
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            For reservations: planned collection date, customer, assigned prep paths, completed steps (who completed each
            step), and checklist lines. Export a PDF for the handover folder or customer paperwork.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePdf}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-semibold text-sm transition shrink-0"
        >
          <FileDown className="w-5 h-5" />
          {exporting ? 'Saving…' : 'Export PDF'}
        </button>
      </div>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Car className="w-4 h-4 text-amber-500" />
          Vehicle
        </h2>
        <p className="text-lg font-semibold text-white">
          {vehicle.brand} {vehicle.model}
          {vehicle.stock_id != null && vehicle.stock_id !== '' ? (
            <span className="text-zinc-400 font-normal ml-2">#{vehicle.stock_id}</span>
          ) : null}
        </p>
        <div className="text-sm text-zinc-400 space-y-1">
          <p>Plate {vehicle.plate_no || '—'}</p>
          {vehicle.vin ? <p>VIN {vehicle.vin}</p> : null}
        </div>
        <Link to={`/vehicle/${vehicle.id}`} className="inline-block text-sm text-amber-500 hover:text-amber-400">
          Open vehicle page →
        </Link>
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-sky-400" />
          Planned pulout (collection date)
        </h2>
        <p className="text-xl font-semibold text-sky-300">
          {vehicle.planned_collection_date ? fmtDate(vehicle.planned_collection_date) : 'Not scheduled yet'}
        </p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Set during reservation workflow or edit the vehicle (status Reserved → Planned collection date). This drives
          delivery reminders.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <User className="w-4 h-4 text-amber-500" />
          Customer details
        </h2>
        {!reserved ? (
          <p className="text-sm text-zinc-500">Vehicle is not currently reserved.</p>
        ) : (
          <ul className="text-sm text-zinc-300 space-y-1.5">
            <li>
              <strong className="text-zinc-500 font-normal text-xs uppercase">Name </strong>
              {vehicle.customer_name || vehicle.buyers_name || '—'}
            </li>
            <li>
              <strong className="text-zinc-500 font-normal text-xs uppercase">Email </strong>
              {vehicle.customer_email || '—'}
            </li>
            <li>
              <strong className="text-zinc-500 font-normal text-xs uppercase">Phone </strong>
              {vehicle.customer_phone || '—'}
            </li>
            {vehicle.deposit_amount != null && vehicle.deposit_amount !== '' ? (
              <li>
                <strong className="text-zinc-500 font-normal text-xs uppercase">Deposit </strong>£
                {Number(vehicle.deposit_amount).toLocaleString()}
              </li>
            ) : null}
            {vehicle.reserved_date ? (
              <li>
                <strong className="text-zinc-500 font-normal text-xs uppercase">Reserved on </strong>
                {fmtDate(vehicle.reserved_date)}
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-5 space-y-6">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-emerald-500" />
          Work paths (prep)
        </h2>
        {instances.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No work paths on this vehicle yet. Use <strong className="text-zinc-400">Assign work path</strong> on the
            vehicle page after reservation.
          </p>
        ) : (
          instances.map((inst, ii) => {
            const steps = inst.steps || []
            const completed = inst.completed_steps || []
            const doneByKey = new Map(completed.map((c) => [c.step_key, c]))
            return (
              <div key={inst.instance_id || ii} className="border border-zinc-800 rounded-xl p-4 space-y-3 bg-zinc-950/40">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-white">{inst.template_name || 'Work path'}</p>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 capitalize">
                    {inst.status || '—'}
                  </span>
                </div>
                {inst.deadline_at ? (
                  <p className="text-xs text-zinc-500">Deadline {fmtDateTime(inst.deadline_at)}</p>
                ) : null}
                <ol className="space-y-3 text-sm">
                  {steps.map((step, si) => {
                    const sk = workflowInstanceStepKey(steps, si)
                    const row = doneByKey.get(sk)
                    const subs = step.subtasks || []
                    return (
                      <li
                        key={sk}
                        className="border border-zinc-800/80 rounded-lg p-3 bg-zinc-900/40"
                      >
                        <div className="flex items-start gap-2">
                          {row ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-200">
                              {si + 1}. {step.title || 'Step'}
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              Assigned: {step.assignee_name || step.assignee_uid || '—'}
                            </p>
                            {row ? (
                              <p className="text-xs text-emerald-400/90 mt-1">
                                Done {fmtDateTime(row.completed_at)} · by{' '}
                                {nameByUid[row.completed_by_uid] || row.completed_by_uid || '—'}
                              </p>
                            ) : (
                              <p className="text-xs text-zinc-500 mt-1">Not completed yet</p>
                            )}
                            {subs.length > 0 ? (
                              <ul className="mt-2 space-y-1 text-xs text-zinc-400 border-t border-zinc-800/60 pt-2">
                                {subs.map((t) => (
                                  <li key={t._key} className="flex items-start gap-2">
                                    <span className="shrink-0">{t.done ? '☑' : '☐'}</span>
                                    <span>
                                      {t.kind === 'image' ? (
                                        <>
                                          Photo{t.body ? `: ${t.body}` : ''}
                                          {t.image_url ? (
                                            <>
                                              {' '}
                                              (<a className="text-amber-500/90 underline" href={t.image_url} target="_blank" rel="noopener noreferrer">
                                                link
                                              </a>
                                              )
                                            </>
                                          ) : null}
                                        </>
                                      ) : (
                                        <>{t.body || '—'}</>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}
