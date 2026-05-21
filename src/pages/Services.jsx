import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarDays,
  Wrench,
  X,
  AlertTriangle,
  Pencil,
  CheckCircle2,
  History,
  CalendarClock,
} from 'lucide-react'
import {
  createWorkshopService,
  fetchAllUserProfiles,
  fetchWorkshopServicesScheduledBetween,
  fetchWorkshopServicesScheduledPage,
  countWorkshopServicesScheduled,
  fetchWorkshopServicesPastPage,
  countWorkshopServicesPast,
  fetchVehiclesForViewingBookingPicker,
  updateWorkshopService,
} from '../lib/sanityData'
import { formatSanityMutationError } from '../lib/sanity'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { LoadingState } from '../components/LoadingState'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function localYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function coerceToLocalYmd(value) {
  if (!value) return ''
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (m) return m[1]
  try {
    const dt = new Date(s)
    if (!Number.isNaN(dt.getTime())) return localYmd(dt)
  } catch {
    /* ignore */
  }
  return ''
}

function serviceIntervalMs(svc) {
  const start = new Date(svc.scheduled_at).getTime()
  const mins = Math.max(Number(svc.duration_minutes) || 60, 15)
  return { start, end: start + mins * 60 * 1000 }
}

function intervalsOverlapMs(a, b) {
  return a.start < b.end && b.start < a.end
}

/** Sorted by start time; attaches overlapsOther using duration overlap. */
function annotateOverlap(sortedByTime) {
  const sorted = [...sortedByTime].sort(
    (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at),
  )
  const enriched = sorted.map((svc) => ({
    svc,
    ...serviceIntervalMs(svc),
  }))
  const flag = enriched.map(() => false)
  for (let i = 0; i < enriched.length; i++) {
    for (let j = i + 1; j < enriched.length; j++) {
      if (intervalsOverlapMs(enriched[i], enriched[j])) {
        flag[i] = true
        flag[j] = true
      }
    }
  }
  return sorted.map((svc, i) => ({ ...svc, overlapsOther: flag[i] }))
}

function calendarPadStart(d) {
  const dow = d.getDay()
  return dow === 0 ? 6 : dow - 1
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function shiftMonth(viewMonth, delta) {
  return new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1)
}

function formatMonthTitle(d) {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(val) {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

function formatHm(iso) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** Service calendar day has started (local date ≤ today) — can mark complete */
function isServiceDateReached(iso) {
  const svcDay = coerceToLocalYmd(iso)
  const today = localYmd(new Date())
  return Boolean(svcDay && today && svcDay <= today)
}

const PAGE_ACTIVE_SIZE = 12
const PAGE_PAST_SIZE = 15

function PaginationBar({
  page,
  totalItems,
  pageSize,
  onPage,
  loading,
  idPrefix,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalItems)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-zinc-800/80 text-xs text-zinc-500">
      <span>
        {totalItems === 0 ? 'No rows' : `Showing ${start}–${end} of ${totalItems}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          id={idPrefix ? `${idPrefix}-prev` : undefined}
          disabled={safePage <= 1 || loading}
          onClick={() => onPage(safePage - 1)}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-zinc-400 tabular-nums px-1">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          id={idPrefix ? `${idPrefix}-next` : undefined}
          disabled={safePage >= totalPages || loading || totalItems === 0}
          onClick={() => onPage(safePage + 1)}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function fmtDateTimeLocal(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return String(iso)
  }
}

const emptyForm = {
  is_asahi_customer: false,
  inventory_vehicle_id: '',
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  vehicle_make: '',
  vehicle_model: '',
  plate: '',
  scheduled_local: '',
  duration_minutes: '60',
  location: '',
  mechanic_firebase_uid: '',
  sales_firebase_uid: '',
  notes: '',
}

function WorkshopDayModal({
  open,
  ymd,
  services,
  onClose,
  onEdit,
  onMarkComplete,
  canEdit,
}) {
  if (!open || !ymd) return null
  const list = annotateOverlap(services || [])
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="svc-day-title"
        className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-2xl flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-zinc-800/90 bg-zinc-900/50">
          <div>
            <h2 id="svc-day-title" className="text-base font-semibold text-white tracking-tight">
              Services on{' '}
              {new Date(`${ymd}T12:00:00`).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Sorted by start time · overlap warnings highlighted</p>
          </div>
          <button
            type="button"
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2 flex-1">
          {!list.length ? (
            <p className="text-sm text-zinc-500 px-2 py-6 text-center">No bookings on this date.</p>
          ) : (
            list.map((svc) => {
              const t = new Date(svc.scheduled_at).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })
              const vehicleLabel = `${svc.vehicle_make} ${svc.vehicle_model}`.trim()
              const asahiBadge = svc.is_asahi_customer
              return (
                <div
                  key={svc.id}
                  className={`rounded-xl border px-3 py-2.5 text-sm flex flex-wrap gap-x-4 gap-y-2 items-start justify-between ${
                    svc.overlapsOther
                      ? 'border-amber-500/50 bg-amber-500/[0.07]'
                      : 'border-zinc-800 bg-zinc-900/35'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-amber-400/95 tabular-nums">{t}</span>
                      {svc.overlapsOther ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-amber-500/95">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Overlap risk
                        </span>
                      ) : null}
                      {svc.status !== 'scheduled' ? (
                        <span className="text-[10px] uppercase text-zinc-500">{svc.status}</span>
                      ) : null}
                    </div>
                    <p className="text-zinc-200 mt-1 font-medium">{svc.customer_name || 'Customer'}</p>
                    <p className="text-zinc-500 text-[13px]">
                      {vehicleLabel || 'Vehicle'}{' '}
                      {svc.plate ? <span className="text-zinc-400 font-mono">· {svc.plate}</span> : null}{' '}
                      {svc.duration_minutes ? (
                        <span className="text-zinc-600">· ~{svc.duration_minutes} min</span>
                      ) : null}
                    </p>
                    {svc.location ? (
                      <p className="text-zinc-500 text-[12px] mt-1">📍 {svc.location}</p>
                    ) : null}
                    {svc.notes ? <p className="text-zinc-400 text-[12px] mt-2 leading-snug">{svc.notes}</p> : null}
                    <p className="text-[11px] text-zinc-600 mt-2">
                      {asahiBadge ? 'Asahi customer (inventory-linked)' : 'External / walk-in'}{' '}
                      {svc.inventory_vehicle_id ? `· Vehicle ref` : ''}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                      {svc.status === 'scheduled' && onMarkComplete && isServiceDateReached(svc.scheduled_at) ? (
                        <button
                          type="button"
                          onClick={() => onMarkComplete(svc)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/90 text-white text-xs hover:bg-emerald-500"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark done
                        </button>
                      ) : null}
                      {svc.status === 'scheduled' ? (
                        <button
                          type="button"
                          onClick={() => onEdit?.(svc)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs border border-amber-500/35 hover:bg-amber-500/30"
                        >
                          <CalendarClock className="w-3.5 h-3.5" /> Reschedule
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onEdit?.(svc)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs hover:bg-zinc-700"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
        <div className="border-t border-zinc-800/90 px-4 py-2 bg-zinc-900/30">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-800/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/** @param {'create'|'edit'} mode */
function ServiceEditorForm({
  mode,
  form,
  setForm,
  vehicles,
  staffOptions,
  vehiclesLoading,
  staffLoading,
  saving,
  onSubmit,
  onCancelEdit,
}) {
  const filteredVehicles = useMemo(() => {
    const rows = [...(vehicles || [])]
    rows.sort((a, b) => String(a.stock_id || '').localeCompare(String(b.stock_id || '')))
    return rows.slice(0, 100)
  }, [vehicles])

  function applyVehicle(ev) {
    const id = ev.target.value
    if (!id) {
      setForm((f) => ({ ...f, inventory_vehicle_id: '' }))
      return
    }
    const v = filteredVehicles.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      inventory_vehicle_id: id,
      vehicle_make: v?.brand || f.vehicle_make,
      vehicle_model: v?.model || f.vehicle_model,
      plate: v?.plate_no || f.plate,
    }))
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {mode === 'edit' ? (
        <button
          type="button"
          onClick={onCancelEdit}
          className="text-xs text-zinc-500 hover:text-zinc-300 underline-offset-4 hover:underline"
        >
          Cancel edit · add new instead
        </button>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Asahi customer (links to inventory vehicle)</span>
        <button
          type="button"
          role="switch"
          aria-checked={form.is_asahi_customer}
          onClick={() =>
            setForm((f) => {
              const next = !f.is_asahi_customer
              return {
                ...f,
                is_asahi_customer: next,
                ...(next ? {} : { inventory_vehicle_id: '' }),
              }
            })
          }
          className={`self-start px-4 py-2 rounded-xl text-xs font-semibold border transition ${
            form.is_asahi_customer
              ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
              : 'border-zinc-700 bg-zinc-900 text-zinc-400'
          }`}
        >
          {form.is_asahi_customer ? 'Yes — inventory customer' : 'No — external / walk-in'}
        </button>
      </label>

      {form.is_asahi_customer ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Inventory vehicle</span>
          <select
            value={form.inventory_vehicle_id}
            onChange={applyVehicle}
            disabled={vehiclesLoading}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white px-3 py-2.5"
          >
            <option value="">{vehiclesLoading ? 'Loading vehicles…' : 'Select vehicle…'}</option>
            {filteredVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                #{v.stock_id} · {v.brand} {v.model}
                {v.plate_no ? ` (${v.plate_no})` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-zinc-400">Customer name *</span>
          <input
            value={form.customer_name}
            onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Phone</span>
          <input
            value={form.customer_phone}
            onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Email</span>
          <input
            type="email"
            value={form.customer_email}
            onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Vehicle make {!form.is_asahi_customer ? '*' : ''}</span>
          <input
            value={form.vehicle_make}
            onChange={(e) => setForm((f) => ({ ...f, vehicle_make: e.target.value }))}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5 disabled:opacity-70"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Vehicle model {!form.is_asahi_customer ? '*' : ''}</span>
          <input
            value={form.vehicle_model}
            onChange={(e) => setForm((f) => ({ ...f, vehicle_model: e.target.value }))}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Plate number</span>
          <input
            value={form.plate}
            onChange={(e) => setForm((f) => ({ ...f, plate: e.target.value }))}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5 font-mono"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Date & time *</span>
          <input
            type="datetime-local"
            value={form.scheduled_local}
            onChange={(e) => setForm((f) => ({ ...f, scheduled_local: e.target.value }))}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Duration (minutes)</span>
          <input
            type="number"
            min={15}
            step={15}
            value={form.duration_minutes}
            onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Service location</span>
        <input
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          placeholder="e.g. Bay 3, roadside, customer address"
          className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5 placeholder:text-zinc-600"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Mechanic assignee</span>
          <select
            value={form.mechanic_firebase_uid}
            onChange={(e) => setForm((f) => ({ ...f, mechanic_firebase_uid: e.target.value }))}
            disabled={staffLoading}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white px-3 py-2.5"
          >
            <option value="">{staffLoading ? 'Loading staff…' : 'Optional'}</option>
            {(staffOptions || []).map((s) => (
              <option key={s.firebase_uid} value={s.firebase_uid}>
                {s.display_name || s.email || s.firebase_uid}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Sales / contact assignee</span>
          <select
            value={form.sales_firebase_uid}
            onChange={(e) => setForm((f) => ({ ...f, sales_firebase_uid: e.target.value }))}
            disabled={staffLoading}
            className="rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-white px-3 py-2.5"
          >
            <option value="">{staffLoading ? 'Loading staff…' : 'Optional'}</option>
            {(staffOptions || []).map((s) => (
              <option key={s.firebase_uid} value={s.firebase_uid}>
                {s.display_name || s.email || s.firebase_uid}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Comment / instructions</span>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
          className="rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2.5 resize-y min-h-[88px]"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {mode === 'edit' ? 'Save changes' : 'Schedule service'}
      </button>
    </form>
  )
}

export function Services() {
  const { user, profile, hasPermission } = useAuth()
  const { addNotification } = useNotification()

  const canView = hasPermission('inventory:view')
  const canEdit = hasPermission('inventory:edit')

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [calendarRows, setCalendarRows] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(true)

  const [tab, setTab] = useState('active')
  const [activePage, setActivePage] = useState(1)
  const [activeList, setActiveList] = useState([])
  const [activeTotal, setActiveTotal] = useState(0)
  const [activeLoading, setActiveLoading] = useState(true)

  const [pastPage, setPastPage] = useState(1)
  const [pastList, setPastList] = useState([])
  const [pastTotal, setPastTotal] = useState(0)
  const [pastLoading, setPastLoading] = useState(true)

  const [vehicles, setVehicles] = useState([])
  const [staffOptions, setStaffOptions] = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [staffLoading, setStaffLoading] = useState(false)

  const [form, setForm] = useState(() => ({
    ...emptyForm,
    scheduled_local: toDatetimeLocal(new Date().toISOString()),
  }))

  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const [modalYmd, setModalYmd] = useState(null)

  const loadCalendar = useCallback(async () => {
    if (!canView) return
    const y = viewMonth.getFullYear()
    const m = viewMonth.getMonth()
    const fromD = new Date(y, m, 1)
    const toD = new Date(y, m + 1, 0, 23, 59, 59, 999)
    setCalendarLoading(true)
    try {
      const rows = await fetchWorkshopServicesScheduledBetween(
        fromD.toISOString(),
        toD.toISOString(),
      )
      setCalendarRows(rows || [])
    } catch (err) {
      addNotification(formatSanityMutationError(err) || 'Could not load calendar', 'error')
      setCalendarRows([])
    } finally {
      setCalendarLoading(false)
    }
  }, [viewMonth, canView, addNotification])

  const loadActive = useCallback(async () => {
    if (!canView) return
    setActiveLoading(true)
    try {
      const [rows, total] = await Promise.all([
        fetchWorkshopServicesScheduledPage(activePage, PAGE_ACTIVE_SIZE),
        countWorkshopServicesScheduled(),
      ])
      setActiveList(rows || [])
      setActiveTotal(typeof total === 'number' ? total : 0)
    } catch (err) {
      addNotification(formatSanityMutationError(err) || 'Could not load active services', 'error')
      setActiveList([])
      setActiveTotal(0)
    } finally {
      setActiveLoading(false)
    }
  }, [canView, activePage, addNotification])

  const loadPast = useCallback(async () => {
    if (!canView) return
    setPastLoading(true)
    try {
      const [rows, total] = await Promise.all([
        fetchWorkshopServicesPastPage(pastPage, PAGE_PAST_SIZE),
        countWorkshopServicesPast(),
      ])
      setPastList(rows || [])
      setPastTotal(typeof total === 'number' ? total : 0)
    } catch (err) {
      addNotification(formatSanityMutationError(err) || 'Could not load past services', 'error')
      setPastList([])
      setPastTotal(0)
    } finally {
      setPastLoading(false)
    }
  }, [canView, pastPage, addNotification])

  const refreshAfterMutation = useCallback(async () => {
    await Promise.all([loadCalendar(), loadActive(), loadPast()])
  }, [loadCalendar, loadActive, loadPast])

  useEffect(() => {
    loadCalendar()
  }, [loadCalendar])

  useEffect(() => {
    if (tab === 'active') loadActive()
  }, [tab, loadActive])

  useEffect(() => {
    if (tab === 'past') loadPast()
  }, [tab, loadPast])

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(activeTotal / PAGE_ACTIVE_SIZE) || 1)
    if (activePage > tp) setActivePage(tp)
  }, [activeTotal, activePage])

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(pastTotal / PAGE_PAST_SIZE) || 1)
    if (pastPage > tp) setPastPage(tp)
  }, [pastTotal, pastPage])

  useEffect(() => {
    if (!canView || !canEdit) return undefined
    let cancelled = false
    setStaffLoading(true)
    fetchAllUserProfiles()
      .then((rows) => {
        if (!cancelled) setStaffOptions(rows || [])
      })
      .catch(() => {
        if (!cancelled) setStaffOptions([])
      })
      .finally(() => {
        if (!cancelled) setStaffLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canView, canEdit])

  useEffect(() => {
    if (!canView || !canEdit) return undefined
    let cancelled = false
    setVehiclesLoading(true)
    fetchVehiclesForViewingBookingPicker()
      .then((rows) => {
        if (!cancelled) setVehicles(rows || [])
      })
      .catch(() => {
        if (!cancelled) setVehicles([])
      })
      .finally(() => {
        if (!cancelled) setVehiclesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canView, canEdit])

  const countsByDay = useMemo(() => {
    const m = new Map()
    for (const svc of calendarRows) {
      const ymd = coerceToLocalYmd(svc.scheduled_at)
      if (!ymd) continue
      const [yy, mm] = ymd.split('-').map(Number)
      if (yy !== viewMonth.getFullYear() || mm - 1 !== viewMonth.getMonth()) continue
      m.set(ymd, (m.get(ymd) || 0) + 1)
    }
    return m
  }, [calendarRows, viewMonth])

  const overlappingDayKeys = useMemo(() => {
    const risky = new Set()
    const y = viewMonth.getFullYear()
    const mo = viewMonth.getMonth()

    /** @type Map<string, any[]> */
    const byDay = new Map()
    for (const svc of calendarRows) {
      const ymd = coerceToLocalYmd(svc.scheduled_at)
      if (!ymd) continue
      const [yy, mm] = ymd.split('-').map(Number)
      if (yy !== y || mm - 1 !== mo) continue
      const list = byDay.get(ymd) || []
      list.push(svc)
      byDay.set(ymd, list)
    }
    byDay.forEach((list, ymd) => {
      const ann = annotateOverlap(list)
      if (ann.some((s) => s.overlapsOther)) risky.add(ymd)
    })
    return risky
  }, [calendarRows, viewMonth])

  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewMonth)
    const pad = calendarPadStart(first)
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()

    /** @type {Array<{kind:'blank'|'day', ymd:string|null, n:number}>} */
    const cells = []

    for (let i = 0; i < pad; i++) cells.push({ kind: 'blank', ymd: null, n: 0 })
    for (let dom = 1; dom <= daysInMonth; dom++) {
      const d = new Date(first.getFullYear(), first.getMonth(), dom)
      const ymd = localYmd(d)
      cells.push({ kind: 'day', ymd, n: dom })
    }
    while (cells.length % 7 !== 0) cells.push({ kind: 'blank', ymd: null, n: 0 })
    return cells
  }, [viewMonth])

  function hydrateFormFromSvc(svc) {
    setForm({
      is_asahi_customer: !!svc.is_asahi_customer,
      inventory_vehicle_id: svc.inventory_vehicle_id || '',
      customer_name: svc.customer_name || '',
      customer_phone: svc.customer_phone || '',
      customer_email: svc.customer_email || '',
      vehicle_make: svc.vehicle_make || '',
      vehicle_model: svc.vehicle_model || '',
      plate: svc.plate || '',
      scheduled_local: toDatetimeLocal(svc.scheduled_at),
      duration_minutes: String(svc.duration_minutes || 60),
      location: svc.location || '',
      mechanic_firebase_uid: svc.mechanic_firebase_uid || '',
      sales_firebase_uid: svc.sales_firebase_uid || '',
      notes: svc.notes || '',
    })
  }

  async function persistForm() {
    const iso = fromDatetimeLocal(form.scheduled_local)
    if (!iso) {
      addNotification('Choose a valid date and time.', 'error')
      return
    }

    const duration = Math.max(Number(form.duration_minutes) || 60, 15)

    try {
      setSaving(true)
      if (editing?.id) {
        await updateWorkshopService(editing.id, {
          is_asahi_customer: form.is_asahi_customer,
          inventory_vehicle_id: form.inventory_vehicle_id,
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          customer_email: form.customer_email.trim(),
          vehicle_make: form.vehicle_make.trim(),
          vehicle_model: form.vehicle_model.trim(),
          plate: form.plate.trim(),
          scheduled_at: iso,
          duration_minutes: duration,
          location: form.location.trim(),
          mechanic_firebase_uid: form.mechanic_firebase_uid,
          sales_firebase_uid: form.sales_firebase_uid,
          notes: form.notes.trim(),
          status: editing.status || 'scheduled',
        })
        addNotification('Service updated.', 'info')
      } else {
        await createWorkshopService({
          is_asahi_customer: form.is_asahi_customer,
          inventory_vehicle_id: form.inventory_vehicle_id,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_email: form.customer_email,
          vehicle_make: form.vehicle_make,
          vehicle_model: form.vehicle_model,
          plate: form.plate,
          scheduled_at: iso,
          duration_minutes: duration,
          location: form.location,
          mechanic_firebase_uid: form.mechanic_firebase_uid,
          sales_firebase_uid: form.sales_firebase_uid,
          notes: form.notes,
          created_by_firebase_uid: user?.uid || '',
          created_by_name: profile?.display_name || user?.displayName || user?.email || '',
        })
        addNotification('Service scheduled.', 'info')
      }
      setEditing(null)
      setForm({
        ...emptyForm,
        scheduled_local: toDatetimeLocal(new Date().toISOString()),
      })
      setModalYmd(null)
      await refreshAfterMutation()
    } catch (e) {
      addNotification(formatSanityMutationError(e) || String(e.message || 'Save failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function setStatusCancelled(svc) {
    if (!canEdit || !svc?.id) return
    try {
      setSaving(true)
      await updateWorkshopService(svc.id, { status: 'cancelled' })
      addNotification('Booking cancelled — it now appears under Past services.', 'info')
      setModalYmd(null)
      setEditing(null)
      await refreshAfterMutation()
    } catch (e) {
      addNotification(formatSanityMutationError(e) || 'Could not cancel', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function markServiceComplete(svc) {
    if (!canEdit || !svc?.id) return
    try {
      setSaving(true)
      await updateWorkshopService(svc.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      addNotification('Marked complete — it now appears under Past services.', 'info')
      setModalYmd(null)
      setEditing(null)
      await refreshAfterMutation()
    } catch (e) {
      addNotification(formatSanityMutationError(e) || 'Could not mark complete', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!canView) {
    return (
      <div className="p-4 max-w-xl">
        <p className="text-zinc-400">You don&apos;t have permission to view workshop services.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24 md:pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-amber-400 shrink-0" />
            Workshop services
          </h1>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Mark jobs <strong className="text-zinc-400 font-medium">Done</strong> once the service day is reached (they move to Past). Reschedule changes the date while the booking stays active. Calendar counts only open bookings.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8 lg:gap-10 items-start">
        <section className="space-y-6 order-2 lg:order-1">
          {!canEdit ? (
            <p className="text-amber-200/90 text-sm bg-amber-500/[0.08] border border-amber-500/25 rounded-xl px-3 py-2">
              View only — editing requires inventory edit permission (same tier as bookings).
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-800/90 p-1.5 bg-zinc-950/80 max-w-xl">
            <button
              type="button"
              onClick={() => {
                setTab('active')
                setActivePage(1)
              }}
              className={`flex-1 min-w-[124px] px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === 'active'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/35'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              Active bookings
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('past')
                setPastPage(1)
              }}
              className={`flex-1 min-w-[124px] px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                tab === 'past'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/35'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              <History className="w-4 h-4 shrink-0 opacity-80" />
              Past services
            </button>
          </div>

          {editing?.id ? (
            <div className="rounded-2xl border border-amber-500/35 bg-zinc-900/50 p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-white font-semibold text-sm uppercase tracking-wide">Edit booking</h2>
                <div className="flex flex-wrap gap-2">
                  {editing.status === 'scheduled' ? (
                    <button
                      type="button"
                      onClick={() => setStatusCancelled(editing)}
                      disabled={saving}
                      className="text-[11px] px-3 py-1.5 rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500/10"
                    >
                      Mark cancelled
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null)
                      setForm({ ...emptyForm, scheduled_local: toDatetimeLocal(new Date().toISOString()) })
                    }}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300"
                  >
                    New booking instead
                  </button>
                </div>
              </div>
              <ServiceEditorForm
                mode="edit"
                form={form}
                setForm={setForm}
                vehicles={vehicles}
                staffOptions={staffOptions}
                vehiclesLoading={vehiclesLoading}
                staffLoading={staffLoading}
                saving={saving}
                onSubmit={persistForm}
                onCancelEdit={() => {
                  setEditing(null)
                  setForm({ ...emptyForm, scheduled_local: toDatetimeLocal(new Date().toISOString()) })
                }}
              />
            </div>
          ) : (
            <>
              {tab === 'active' && canEdit ? (
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-5">
                  <h2 className="text-white font-semibold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-amber-400" /> Schedule a service
                  </h2>
                  <ServiceEditorForm
                    mode="create"
                    form={form}
                    setForm={setForm}
                    vehicles={vehicles}
                    staffOptions={staffOptions}
                    vehiclesLoading={vehiclesLoading}
                    staffLoading={staffLoading}
                    saving={saving}
                    onSubmit={persistForm}
                    onCancelEdit={() => {}}
                  />
                </div>
              ) : null}

              {tab === 'active' ? (
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-4">
                  <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    Scheduled jobs (paginated, earliest first)
                  </h3>
                  {activeLoading ? (
                    <LoadingState message="" variant="embedded" />
                  ) : !activeList.length ? (
                    <p className="text-sm text-zinc-600 py-6 text-center">No active bookings. Schedule one above or check Past.</p>
                  ) : (
                    <>
                      <ul className="space-y-2 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
                        {activeList.map((svc) => {
                          const ymd = coerceToLocalYmd(svc.scheduled_at)
                          let dayPool = calendarRows.filter(
                            (x) => coerceToLocalYmd(x.scheduled_at) === ymd,
                          )
                          if (dayPool.length === 0) {
                            dayPool = activeList.filter(
                              (x) => coerceToLocalYmd(x.scheduled_at) === ymd,
                            )
                          }
                          const rowAnn = annotateOverlap(dayPool)
                          const thisOne = rowAnn.find((x) => x.id === svc.id)
                          const ov = thisOne?.overlapsOther
                          const vehicleLabel = `${svc.vehicle_make} ${svc.vehicle_model}`.trim()
                          return (
                            <li
                              key={svc.id}
                              className="rounded-xl border border-zinc-800/60 bg-zinc-900/35 px-3 py-2.5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setModalYmd(ymd)}
                                  className="text-left flex-1 min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                                >
                                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    <span className="text-[11px] text-zinc-500 tabular-nums w-[88px] shrink-0">
                                      {ymd}
                                    </span>
                                    <span className="text-amber-400/95 text-[13px] font-medium tabular-nums w-[52px] shrink-0">
                                      {formatHm(svc.scheduled_at)}
                                    </span>
                                    <span
                                      className={`flex-1 min-w-0 text-sm ${ov ? 'text-amber-200' : 'text-zinc-200'}`}
                                    >
                                      {svc.customer_name}
                                      {' · '}
                                      <span className="text-zinc-400">{vehicleLabel || 'Vehicle'}</span>
                                      {ov ? (
                                        <span className="ml-2 text-[10px] uppercase text-amber-500 font-semibold">
                                          overlap
                                        </span>
                                      ) : null}
                                    </span>
                                  </div>
                                </button>
                                {canEdit ? (
                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
                                    {isServiceDateReached(svc.scheduled_at) ? (
                                      <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => markServiceComplete(svc)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/85 text-white text-[11px] font-medium hover:bg-emerald-500 disabled:opacity-50"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Done
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() => {
                                        setTab('active')
                                        setEditing(svc)
                                        hydrateFormFromSvc(svc)
                                        window.scrollTo({ top: 0, behavior: 'smooth' })
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 text-[11px] font-medium border border-amber-500/25"
                                    >
                                      <CalendarClock className="w-3 h-3" />
                                      Reschedule
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                      <PaginationBar
                        page={activePage}
                        totalItems={activeTotal}
                        pageSize={PAGE_ACTIVE_SIZE}
                        onPage={setActivePage}
                        loading={activeLoading}
                        idPrefix="ws-active"
                      />
                    </>
                  )}
                </div>
              ) : null}

              {tab === 'past' ? (
                <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-4">
                  <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <History className="w-3.5 h-3.5 opacity-70" />
                    Past services (completed &amp; cancelled)
                  </h3>
                  {pastLoading ? (
                    <LoadingState message="" variant="embedded" />
                  ) : !pastList.length ? (
                    <p className="text-sm text-zinc-600 py-6 text-center">No past rows yet.</p>
                  ) : (
                    <>
                      <ul className="space-y-2 max-h-[min(480px,55vh)] overflow-y-auto pr-1">
                        {pastList.map((svc) => {
                          const vehicleLabel = `${svc.vehicle_make} ${svc.vehicle_model}`.trim()
                          const endReason =
                            svc.status === 'completed'
                              ? svc.completed_at
                                ? fmtDateTimeLocal(svc.completed_at)
                                : 'Completed'
                              : svc.cancelled_at
                                ? `Cancelled ${fmtDateTimeLocal(svc.cancelled_at)}`
                                : 'Cancelled'
                          return (
                            <li
                              key={svc.id}
                              className="rounded-xl border border-zinc-800/60 bg-zinc-900/35 px-3 py-2.5 text-sm"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-zinc-200 font-medium">{svc.customer_name}</span>
                                <span
                                  className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                                    svc.status === 'completed'
                                      ? 'bg-emerald-500/15 text-emerald-400'
                                      : 'bg-zinc-700/50 text-zinc-400'
                                  }`}
                                >
                                  {svc.status}
                                </span>
                              </div>
                              <p className="text-zinc-500 text-[13px] mt-1">
                                {vehicleLabel || 'Vehicle'}
                                {svc.plate ? (
                                  <span className="text-zinc-600 font-mono ml-1">· {svc.plate}</span>
                                ) : null}
                              </p>
                              <p className="text-[11px] text-zinc-600 mt-1.5">
                                Scheduled {fmtDateTimeLocal(svc.scheduled_at)}
                                {svc.location ? ` · ${svc.location}` : ''}
                              </p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">{endReason}</p>
                            </li>
                          )
                        })}
                      </ul>
                      <PaginationBar
                        page={pastPage}
                        totalItems={pastTotal}
                        pageSize={PAGE_PAST_SIZE}
                        onPage={setPastPage}
                        loading={pastLoading}
                        idPrefix="ws-past"
                      />
                    </>
                  )}
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="order-1 lg:order-2 space-y-3 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-3">
            <div className="flex items-center justify-between mb-2 px-1 gap-2">
              <button
                type="button"
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 shrink-0"
                onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center min-w-0">
                <span className="text-sm font-semibold text-white block truncate">
                  {formatMonthTitle(viewMonth)}
                </span>
                {calendarLoading ? (
                  <p className="text-[10px] text-amber-500/90 mt-0.5">Loading month…</p>
                ) : null}
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800 shrink-0"
                onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] uppercase text-zinc-500 mb-1">
              {WEEKDAY_LABELS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {calendarCells.map((cell, idx) =>
                cell.kind === 'blank' ? (
                  <div key={`b-${idx}`} className="aspect-square rounded-md bg-transparent" aria-hidden />
                ) : (
                  <button
                    key={cell.ymd}
                    type="button"
                    onClick={() => setModalYmd(cell.ymd)}
                    className={`aspect-square rounded-lg text-[13px] font-medium transition flex flex-col items-center justify-center relative ${
                      countsByDay.get(cell.ymd || '')
                        ? overlappingDayKeys.has(cell.ymd)
                          ? 'bg-amber-500/25 text-amber-100 hover:bg-amber-500/35 border border-amber-500/40'
                          : 'bg-emerald-500/[0.12] text-emerald-200 hover:bg-emerald-500/22 border border-emerald-500/25'
                        : 'bg-zinc-950/60 text-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{cell.n}</span>
                    {countsByDay.get(cell.ymd || '') ? (
                      <span className="text-[9px] leading-none">{countsByDay.get(cell.ymd || '')}</span>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          </div>
          <p className="text-[11px] text-zinc-600 px-1">
            Bold highlight = time overlap detected. Tap any day with jobs to inspect the timetable.
          </p>
        </aside>
      </div>

      <WorkshopDayModal
        open={Boolean(modalYmd)}
        ymd={modalYmd}
        services={
          modalYmd ? (calendarRows || []).filter((s) => coerceToLocalYmd(s.scheduled_at) === modalYmd) : []
        }
        onClose={() => setModalYmd(null)}
        canEdit={canEdit}
        onMarkComplete={markServiceComplete}
        onEdit={(svc) => {
          if (!svc) return
          setTab('active')
          setEditing(svc)
          hydrateFormFromSvc(svc)
          setModalYmd(null)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </div>
  )
}
