import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Download,
  FileCheck,
  Loader2,
  Save,
} from 'lucide-react'
import {
  PDI_CHECKS_COL1,
  PDI_CHECKS_COL2,
  PDI_MECHANIC_CHECKS,
  PDI_TYRE_KEYS,
  isPdiFinalized,
  normalizePdiInspection,
  pdiCheckboxProgress,
  seedPdiFromVehicleAndCustomer,
  serializePdiForStorage,
} from '../lib/pdiInspectionModel'
import {
  saveVehiclePdiInspectionJson,
  fetchWorkflowUpdates,
  insertWorkflowUpdate,
} from '../lib/sanityData'
import { RESERVATION_STEPS } from '../lib/reservationWorkflow'
import { useNotification } from '../context/NotificationContext'
import { downloadVehiclePdiPdf } from '../lib/exportVehiclePdiPdf'

function deviceInfoSnippet() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  const mobile = /Mobile|Android|iPhone/i.test(ua)
  return `${mobile ? 'Mobile' : 'Desktop'} · ${navigator.platform || 'web'}`
}

function mergeLocalWithVehicleSeed(vehicle) {
  const existing = vehicle?.pdi_inspection
  const base =
    existing && typeof existing === 'object'
      ? normalizePdiInspection(existing)
      : seedPdiFromVehicleAndCustomer(vehicle, {})
  return normalizePdiInspection(base)
}

/**
 * Reserved-vehicle Pre-Delivery Inspection: fills checklist on the vehicle (`pdi_inspection_json`).
 */
export function PdiReservationPanel({ vehicle, user, profile, canEdit, canViewInventory, onUpdated }) {
  const { addNotification } = useNotification()
  const [open, setOpen] = useState(true)
  const [state, setState] = useState(() =>
    mergeLocalWithVehicleSeed(vehicle || {})
  )
  const [saveBusy, setSaveBusy] = useState(false)
  const [finalizeBusy, setFinalizeBusy] = useState(false)

  const inspectionSyncKey = useMemo(
    () =>
      `${vehicle?.id ?? ''}|${vehicle?.updated_at ?? ''}|${serializePdiForStorage(vehicle?.pdi_inspection ?? null)}`,
    [vehicle?.id, vehicle?.updated_at, vehicle?.pdi_inspection],
  )

  /* eslint-disable react-hooks/exhaustive-deps -- keyed by canonical PDI JSON + revision only */
  useEffect(() => {
    setState(mergeLocalWithVehicleSeed(vehicle || {}))
  }, [inspectionSyncKey])
  /* eslint-enable react-hooks/exhaustive-deps */

  const done = isPdiFinalized(state)
  const prog = pdiCheckboxProgress(state)

  const setHeaderField = useCallback((key, val) => {
    setState((s) =>
      normalizePdiInspection({
        ...s,
        header: { ...s.header, [key]: val },
      })
    )
  }, [])

  const toggleMain = useCallback((key) => {
    setState((s) =>
      normalizePdiInspection({
        ...s,
        checks_main: { ...s.checks_main, [key]: !s.checks_main[key] },
      })
    )
  }, [])

  const toggleMechanic = useCallback((key) => {
    setState((s) =>
      normalizePdiInspection({
        ...s,
        checks_mechanic: { ...s.checks_mechanic, [key]: !s.checks_mechanic[key] },
      })
    )
  }, [])

  const toggleTyre = useCallback((key) => {
    setState((s) =>
      normalizePdiInspection({
        ...s,
        tyre_tread: { ...s.tyre_tread, [key]: !s.tyre_tread[key] },
      })
    )
  }, [])

  async function handleSaveDraft() {
    if (!vehicle?.id || !canEdit) return
    setSaveBusy(true)
    try {
      await saveVehiclePdiInspectionJson(vehicle.id, state)
      addNotification('PDI checklist saved', 'success')
      onUpdated?.()
    } catch (e) {
      addNotification(e.message || 'Could not save', 'error')
    } finally {
      setSaveBusy(false)
    }
  }

  async function handleFinalize() {
    if (!vehicle?.id || !canEdit) return
    if (!window.confirm('Mark PDI as complete on this checklist and advance the reservation workflow (Pre-delivery inspection step)?')) {
      return
    }
    setFinalizeBusy(true)
    try {
      const next = normalizePdiInspection({
        ...state,
        finalized_at: new Date().toISOString(),
        finalized_by_uid: user?.uid || '',
        finalized_by_name:
          profile?.display_name ||
          profile?.email ||
          user?.email ||
          user?.uid ||
          'Staff',
      })
      await saveVehiclePdiInspectionJson(vehicle.id, next)

      const rows = await fetchWorkflowUpdates(vehicle.id)
      const hasPdiRow = (rows || []).some((r) => r.step_key === 'pdi')
      if (!hasPdiRow) {
        const step = RESERVATION_STEPS.find((s) => s.key === 'pdi')
        if (step) {
          await insertWorkflowUpdate({
            vehicle_id: vehicle.id,
            step_key: step.key,
            step_label: step.label,
            status: 'done',
            comment: 'PDI checklist completed in vehicle record',
            updated_by: user?.uid || '',
            updated_by_name:
              profile?.display_name || profile?.email || user?.email || user?.uid || 'Staff',
            device_info: deviceInfoSnippet(),
          })
        }
      }
      addNotification('PDI marked complete', 'success')
      setState(next)
      onUpdated?.()
    } catch (e) {
      addNotification(e.message || 'Could not finalize', 'error')
    } finally {
      setFinalizeBusy(false)
    }
  }

  function handleExportPdf() {
    downloadVehiclePdiPdf(vehicle, state, `pdi-${vehicle?.stock_id || vehicle?.plate_no || vehicle?.id || 'vehicle'}`)
  }

  /** When reserved but Sanity has no checklist row yet — offer reset from stock data */
  function handleSeedFromVehicle() {
    const seeded = normalizePdiInspection(seedPdiFromVehicleAndCustomer(vehicle, {}))
    setState(seeded)
    addNotification('Header fields refreshed from vehicle (save to persist)', 'info')
  }

  if (!vehicle?.reserved || vehicle.sold) return null

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 overflow-hidden mb-8">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-emerald-500/10 border-b border-emerald-500/20 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              done ? 'bg-emerald-500/25 text-emerald-400' : 'bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {done ? <FileCheck className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white flex flex-wrap items-center gap-2">
              Pre-Delivery Inspection (PDI)
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                  done
                    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15'
                    : 'text-amber-300 border-amber-500/35 bg-amber-500/10'
                }`}
              >
                {done ? 'PDI done' : 'PDI in progress'}
              </span>
            </p>
            <p className="text-xs text-emerald-200/70 mt-0.5">
              Checkboxes + header match the paperwork; export PDF for MD seal / customer file.
              {prog.total > 0 ? (
                <span className="text-zinc-400">
                  {' '}
                  · {prog.checked}/{prog.total} checklist ticks
                </span>
              ) : null}
            </p>
            {done && state.finalized_at ? (
              <p className="text-[11px] text-zinc-500 mt-1">
                Completed{' '}
                {new Date(state.finalized_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {state.finalized_by_name ? ` · ${state.finalized_by_name}` : ''}
              </p>
            ) : null}
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-500 shrink-0" />
        )}
      </button>

      {open ? (
        <div className="p-4 space-y-6 max-h-[min(72vh,1100px)] overflow-y-auto">
          {(canEdit || canViewInventory) && (
            <div className="flex flex-wrap gap-2">
              {(canEdit || canViewInventory) && (
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm hover:bg-zinc-700 transition"
                >
                  <Download className="w-4 h-4" />
                  Export PDI PDF
                </button>
              )}
              {canEdit && !vehicle.pdi_inspection && (
                <button
                  type="button"
                  onClick={handleSeedFromVehicle}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/40 text-emerald-400 text-sm hover:bg-emerald-500/10 transition"
                >
                  Prefill header from vehicle
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={handleSaveDraft}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium disabled:opacity-40 transition"
                  >
                    {saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={finalizeBusy || done}
                    onClick={handleFinalize}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-40 transition"
                  >
                    {finalizeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                    Complete PDI
                  </button>
                </>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="REG number"
              value={state.header.reg_number}
              onChange={(v) => setHeaderField('reg_number', v)}
              disabled={!canEdit}
            />
            <Field label="VIN number" value={state.header.vin_number} onChange={(v) => setHeaderField('vin_number', v)} disabled={!canEdit} />
            <Field label="Mileage" value={state.header.mileage} onChange={(v) => setHeaderField('mileage', v)} disabled={!canEdit} />
            <Field label="Date" type="date" value={state.header.date_iso} onChange={(v) => setHeaderField('date_iso', v)} disabled={!canEdit} />
            <Field label="Make & model" value={state.header.make_model} onChange={(v) => setHeaderField('make_model', v)} disabled={!canEdit} span />
            <Field label="Customer" value={state.header.customer} onChange={(v) => setHeaderField('customer', v)} disabled={!canEdit} span />
            <Field label="Assessor" value={state.header.assessor} onChange={(v) => setHeaderField('assessor', v)} disabled={!canEdit} />
            <Field label="Signature line" value={state.header.signature} onChange={(v) => setHeaderField('signature', v)} disabled={!canEdit} />
          </div>

          <section>
            <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Inspection items</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <CheckGrid items={PDI_CHECKS_COL1} checks={state.checks_main} onToggle={toggleMain} disabled={!canEdit} />
              <CheckGrid items={PDI_CHECKS_COL2} checks={state.checks_main} onToggle={toggleMain} disabled={!canEdit} />
            </div>
          </section>

          <section>
            <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Tyre tread</h4>
            <div className="flex flex-wrap gap-4">
              {PDI_TYRE_KEYS.map((t) => (
                <label key={t.key} className="inline-flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-950 text-emerald-500 disabled:opacity-40"
                    checked={!!state.tyre_tread[t.key]}
                    disabled={!canEdit}
                    onChange={() => toggleTyre(t.key)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Mechanic / service tech (photos evidenced)
            </h4>
            <div className="space-y-2">
              {PDI_MECHANIC_CHECKS.map((m) => (
                <label key={m.key} className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600 bg-zinc-950 text-emerald-500 mt-1 shrink-0 disabled:opacity-40"
                    checked={!!state.checks_mechanic[m.key]}
                    disabled={!canEdit}
                    onChange={() => toggleMechanic(m.key)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Damages including locations</label>
              <textarea
                rows={4}
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                value={state.damages}
                disabled={!canEdit}
                onChange={(e) =>
                  setState((s) => normalizePdiInspection({ ...s, damages: e.target.value }))
                }
                placeholder="Describe any defects and where they appear"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider">
                Approved by Managing Director (name / initials for paperwork)
              </label>
              <input
                className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                value={state.header.md_signature}
                disabled={!canEdit}
                onChange={(e) => setHeaderField('md_signature', e.target.value)}
                placeholder="Manager signs printed PDF — typed name optional here"
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', disabled, span }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50"
      />
    </div>
  )
}

function CheckGrid({ items, checks, onToggle, disabled }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 divide-y divide-zinc-800/60">
      {items.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 cursor-pointer hover:bg-zinc-900/60">
          <input
            type="checkbox"
            className="rounded border-zinc-600 bg-zinc-950 text-emerald-500 shrink-0 disabled:opacity-40"
            checked={!!checks[key]}
            disabled={disabled}
            onChange={() => onToggle(key)}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  )
}
