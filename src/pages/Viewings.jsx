import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CalendarClock, Search, ExternalLink, PlusCircle } from 'lucide-react'
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

  const rows = useMemo(
    () => flattenRows(vehicles, user?.uid || ''),
    [vehicles, user?.uid]
  )

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

  if (!canView) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">You don&apos;t have permission to view viewings.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-sky-400" />
            Viewings
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Use <span className="text-zinc-400 font-medium">Add new</span> to book against any vehicle. Multiple bookings per car keep separate notes. Open a vehicle to change status or remove rows.
          </p>
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

      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 mb-6 space-y-4">
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

      <NewViewingBookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onBooked={load}
      />
    </div>
  )
}
