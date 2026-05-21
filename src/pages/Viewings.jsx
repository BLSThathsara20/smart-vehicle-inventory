import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CalendarClock, Search, ExternalLink, PlusCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { fetchVehiclesForViewingsPage } from '../lib/sanityData'
import { NewViewingBookingModal } from '../components/NewViewingBookingModal'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { LoadingState } from '../components/LoadingState'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
]

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

function flattenRows(vehicles, currentUid) {
  const out = []
  for (const v of vehicles || []) {
    for (const b of v.viewing_bookings || []) {
      out.push({
        vehicleId: v.id,
        stock_id: v.stock_id,
        brand: v.brand,
        model: v.model,
        sold: v.sold,
        reserved: v.reserved,
        booking: b,
        mentionsMe: (b.mentioned_firebase_uids || []).includes(currentUid),
      })
    }
  }
  return out
}

function ViewingDayModal({ ymd, rows, onClose, onOpenVehicle }) {
  if (!ymd) return null
  const sorted = [...(rows || [])].sort(
    (a, b) => new Date(a.booking.scheduled_at || 0) - new Date(b.booking.scheduled_at || 0),
  )
  const label = (() => {
    try {
      return new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return ymd
    }
  })()

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="vdm-title"
        className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <h2 id="vdm-title" className="text-sm font-semibold text-white">
              Viewings on {label}
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Scheduled appointments ({sorted.length})</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2 flex-1">
          {sorted.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No scheduled viewings on this day.</p>
          ) : (
            sorted.map((r) => {
              const b = r.booking
              const t = b.scheduled_at
                ? new Date(b.scheduled_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '—'
              return (
                <div
                  key={`${r.vehicleId}-${b.id}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-sm flex flex-wrap items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sky-300/95 font-medium tabular-nums">{t}</p>
                    <p className="text-white font-medium mt-0.5">{b.customer_name || 'Customer'}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {r.brand} {r.model}
                      {r.stock_id != null && r.stock_id !== '' ? ` · #${r.stock_id}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      onOpenVehicle(r.vehicleId, !r.reserved && !r.sold)
                    }}
                    className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-200 hover:bg-zinc-700"
                  >
                    Open vehicle
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="border-t border-zinc-800 px-4 py-2 bg-zinc-900/30">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-800/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function Viewings() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const { addNotification } = useNotification()
  const canView = hasPermission('inventory:view')
  const canBookViewings = hasPermission('inventory:edit')
  const canAddVehicle = hasPermission('inventory:add')
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadMessage, setLoadMessage] = useState('Loading viewings…')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [onlyMentions, setOnlyMentions] = useState(false)
  const [includeSold, setIncludeSold] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [bookingOpen, setBookingOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [dayModalYmd, setDayModalYmd] = useState(null)

  async function load() {
    setLoading(true)
    setLoadMessage('Loading viewings…')
    try {
      const data = await fetchVehiclesForViewingsPage()
      setVehicles(data || [])
    } catch (e) {
      addNotification(e.message || 'Failed to load', 'error')
      setVehicles([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when tab allowed
  }, [canView])

  const rows = useMemo(() => flattenRows(vehicles, user?.uid || ''), [vehicles, user?.uid])

  const scheduledRowsForCalendar = useMemo(
    () => rows.filter((r) => (r.booking.status || 'scheduled') === 'scheduled'),
    [rows],
  )

  const viewingCountsByDay = useMemo(() => {
    const m = new Map()
    const y = viewMonth.getFullYear()
    const mo = viewMonth.getMonth()
    for (const r of scheduledRowsForCalendar) {
      const ymd = coerceToLocalYmd(r.booking.scheduled_at)
      if (!ymd) continue
      const [yy, mm] = ymd.split('-').map(Number)
      if (yy !== y || mm - 1 !== mo) continue
      m.set(ymd, (m.get(ymd) || 0) + 1)
    }
    return m
  }, [scheduledRowsForCalendar, viewMonth])

  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewMonth)
    const pad = calendarPadStart(first)
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    /** @type {Array<{kind:'blank'|'day',ymd:string|null,n:number}>} */
    const cells = []
    for (let i = 0; i < pad; i++) cells.push({ kind: 'blank', ymd: null, n: 0 })
    for (let dom = 1; dom <= daysInMonth; dom++) {
      const d = new Date(first.getFullYear(), first.getMonth(), dom)
      cells.push({ kind: 'day', ymd: localYmd(d), n: dom })
    }
    while (cells.length % 7 !== 0) cells.push({ kind: 'blank', ymd: null, n: 0 })
    return cells
  }, [viewMonth])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!includeSold && r.sold) return false
      if (onlyMentions && !r.mentionsMe) return false
      const st = r.booking.status || 'scheduled'
      if (statusFilter !== 'all' && st !== statusFilter) return false
      const at = r.booking.scheduled_at
      if (dateFrom && (!at || String(at).slice(0, 10) < dateFrom)) return false
      if (dateTo && (!at || String(at).slice(0, 10) > dateTo)) return false
      if (!q) return true
      const hay = [
        r.stock_id,
        r.brand,
        r.model,
        r.booking.customer_name,
        r.booking.customer_phone,
        r.booking.notes,
        r.booking.staff_message,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, query, statusFilter, onlyMentions, includeSold, dateFrom, dateTo])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = new Date(a.booking.scheduled_at || 0).getTime()
      const tb = new Date(b.booking.scheduled_at || 0).getTime()
      return tb - ta
    })
  }, [filtered])

  const modalDayRows = useMemo(() => {
    if (!dayModalYmd) return []
    return scheduledRowsForCalendar.filter((r) => coerceToLocalYmd(r.booking.scheduled_at) === dayModalYmd)
  }, [dayModalYmd, scheduledRowsForCalendar])

  if (!canView) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to view viewings.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:p-8 md:pb-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-sky-400" />
            Viewings
          </h1>
          <p className="text-zinc-500 text-sm mt-1 max-w-2xl">
            Book with <span className="text-zinc-400 font-medium">Add new</span> on available inventory only —
            sold or reserved vehicles cannot take new appointments. Manage or remove rows from each vehicle&apos;s screen.
          </p>
          <p className="text-zinc-600 text-[11px] mt-2">The sidebar calendar counts scheduled viewings per day.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end shrink-0 self-start sm:self-auto">
          {canBookViewings ? (
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition"
            >
              <PlusCircle className="w-5 h-5 shrink-0" aria-hidden />
              Add new
            </button>
          ) : null}
          {canAddVehicle ? (
            <Link
              to="/app/add"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold text-sm transition"
            >
              Add vehicle
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8 lg:gap-10 items-start">
        <div className="space-y-6 order-2 lg:order-1 min-w-0">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search stock, model, customer, notes…"
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white placeholder:text-zinc-600"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white px-3 py-2.5"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white px-3 py-2.5"
                aria-label="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white px-3 py-2.5"
                aria-label="To date"
              />
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSold}
                  onChange={(e) => setIncludeSold(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-900 text-amber-500"
                />
                Include sold vehicles
              </label>
              <label className="flex items-center gap-2 text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyMentions}
                  onChange={(e) => setOnlyMentions(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-900 text-sky-500"
                />
                Only @mentions of me
              </label>
              <button
                type="button"
                onClick={() => load()}
                className="text-amber-400 hover:text-amber-300 text-sm font-medium"
              >
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingState message={loadMessage} variant="embedded" className="py-24" />
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-zinc-800/50 bg-zinc-900/40">
              <CalendarClock className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-400 font-medium">No viewings match your filters</p>
              <p className="text-zinc-600 text-sm mt-1">Try clearing search or date range</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 mb-2">{sorted.length} booking{sorted.length === 1 ? '' : 's'}</p>
              {sorted.map((r) => {
                const b = r.booking
                const st = b.status || 'scheduled'
                return (
                  <div
                    key={`${r.vehicleId}-${b.id}`}
                    className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {b.customer_name || 'Customer'}
                        <span className="text-zinc-500 font-normal">
                          {' '}
                          ·{' '}
                          {b.scheduled_at
                            ? new Date(b.scheduled_at).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {r.brand} {r.model}
                        {r.stock_id != null && r.stock_id !== '' ? ` · #${r.stock_id}` : ''}
                        {r.sold ? <span className="text-rose-400/90"> · Sold</span> : null}
                        {r.reserved && !r.sold ? <span className="text-amber-400/90"> · Reserved</span> : null}
                      </p>
                      {b.staff_message ? (
                        <p className="text-xs text-amber-200/70 mt-1 truncate">{b.staff_message}</p>
                      ) : null}
                      <span
                        className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                          st === 'scheduled'
                            ? 'text-sky-400 border-sky-500/40 bg-sky-500/10'
                            : st === 'completed'
                              ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                              : 'text-zinc-400 border-zinc-600 bg-zinc-800/60'
                        }`}
                      >
                        {STATUS_OPTIONS.find((o) => o.value === st)?.label || st}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const openModal = !r.reserved && !r.sold
                        navigate(`/vehicle/${r.vehicleId}${openModal ? '?viewings=1' : ''}`)
                      }}
                      className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm text-zinc-200 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open vehicle
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <aside className="order-1 lg:order-2 space-y-3 lg:sticky lg:top-24 w-full max-w-md mx-auto lg:max-w-none lg:mx-0">
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
                <span className="text-sm font-semibold text-white block truncate">{formatMonthTitle(viewMonth)}</span>
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
                    onClick={() => cell.ymd && setDayModalYmd(cell.ymd)}
                    className={`aspect-square rounded-lg text-[13px] font-medium transition flex flex-col items-center justify-center relative ${
                      viewingCountsByDay.get(cell.ymd || '')
                        ? 'bg-sky-500/[0.15] text-sky-200 hover:bg-sky-500/25 border border-sky-500/35'
                        : 'bg-zinc-950/60 text-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{cell.n}</span>
                    {viewingCountsByDay.get(cell.ymd || '') ? (
                      <span className="text-[9px] leading-none tabular-nums">{viewingCountsByDay.get(cell.ymd || '')}</span>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          </div>
          <p className="text-[11px] text-zinc-600 px-1">
            Numbers are scheduled-only viewings. Tap a day to see that day&apos;s list.
          </p>
        </aside>
      </div>

      <ViewingDayModal
        ymd={dayModalYmd}
        rows={modalDayRows}
        onClose={() => setDayModalYmd(null)}
        onOpenVehicle={(vehicleId, openViewingsUi) =>
          navigate(`/vehicle/${vehicleId}${openViewingsUi ? '?viewings=1' : ''}`)
        }
      />

      <NewViewingBookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} onBooked={load} />
    </div>
  )
}
