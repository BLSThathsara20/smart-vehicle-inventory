import { useEffect, useMemo, useState } from 'react'
import * as ReactRouter from 'react-router-dom'
import {
  CalendarClock,
  Loader2,
  Plus,
  X,
  Search,
  Car,
  ChevronDown,
  Check,
} from 'lucide-react'
import {
  addVehicleViewingBooking,
  fetchAllUserProfiles,
  fetchVehiclesForViewingBookingPicker,
} from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'

function fromDatetimeLocal(val) {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

const initialForm = {
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  scheduled_local: '',
  notes: '',
  staff_message: '',
  notify_managers: true,
  mentionUids: [],
}

const MAX_VEHICLE_ROWS = 80

/** Book a viewing from the Viewings hub: pick any vehicle + same fields as VehicleDetail bookings. */
export function NewViewingBookingModal({ open, onClose, onBooked }) {
  const navigate = ReactRouter.useNavigate()
  const { user, profile, hasPermission } = useAuth()
  const { addNotification } = useNotification()
  const canBook = hasPermission('inventory:edit')

  const [vehiclesLoading, setVehiclesLoading] = useState(false)
  const [vehicles, setVehicles] = useState([])
  const [vehicleQuery, setVehicleQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const [staffOptions, setStaffOptions] = useState([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)

  const uid = user?.uid || ''
  const displayName = profile?.display_name || user?.displayName || user?.email || ''

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedId) || null,
    [vehicles, selectedId]
  )

  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase()
    const rows = [...(vehicles || [])].filter((v) => {
      if (!q) return true
      const hay = [v.stock_id, v.plate_no, v.brand, v.model].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
    rows.sort((a, b) => {
      const aBad = (a.sold ? 4 : 0) + (a.reserved ? 2 : 0)
      const bBad = (b.sold ? 4 : 0) + (b.reserved ? 2 : 0)
      if (aBad !== bBad) return aBad - bBad
      return String(a.stock_id || '').localeCompare(String(b.stock_id || ''))
    })
    return rows.slice(0, MAX_VEHICLE_ROWS)
  }, [vehicles, vehicleQuery])

  useEffect(() => {
    if (!open || !canBook) return
    let cancelled = false
    setVehiclesLoading(true)
    fetchVehiclesForViewingBookingPicker()
      .then((rows) => {
        if (!cancelled) setVehicles(rows || [])
      })
      .catch(() => {
        if (!cancelled) {
          addNotification('Could not load vehicles', 'error')
          setVehicles([])
        }
      })
      .finally(() => {
        if (!cancelled) setVehiclesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, canBook, addNotification])

  useEffect(() => {
    if (!open || !canBook) return
    let cancelled = false
    setStaffLoading(true)
    fetchAllUserProfiles()
      .then((rows) => {
        if (cancelled) return
        const filtered = (rows || []).filter((r) => r.firebase_uid && r.firebase_uid !== uid)
        setStaffOptions(filtered)
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
  }, [open, canBook, uid])

  useEffect(() => {
    if (!open) {
      setVehicleQuery('')
      setSelectedId(null)
      setForm(initialForm)
      setStaffOptions([])
      setVehicles([])
    }
  }, [open])

  const bookable =
    canBook &&
    selectedVehicle &&
    !selectedVehicle.sold &&
    !selectedVehicle.reserved

  function toggleMention(firebaseUid) {
    setForm((f) => {
      const set = new Set(f.mentionUids)
      if (set.has(firebaseUid)) set.delete(firebaseUid)
      else set.add(firebaseUid)
      return { ...f, mentionUids: [...set] }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!bookable || !selectedId || submitting) return
    const scheduled_at = fromDatetimeLocal(form.scheduled_local)
    if (!scheduled_at) {
      addNotification('Pick a date and time for the viewing', 'error')
      return
    }
    if (!String(form.customer_name || '').trim()) {
      addNotification('Customer name is required', 'error')
      return
    }
    setSubmitting(true)
    try {
      await addVehicleViewingBooking(
        selectedId,
        {
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_email: form.customer_email,
          scheduled_at,
          notes: form.notes,
          staff_message: form.staff_message,
          notify_managers: form.notify_managers,
          mentioned_firebase_uids: form.mentionUids,
          status: 'scheduled',
        },
        { uid, displayName }
      )
      addNotification('Viewing booked', 'success')
      setForm(initialForm)
      onBooked?.()
      onClose()
    } catch (err) {
      addNotification(err.message || 'Could not save booking', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700/80 shadow-2xl w-full max-w-xl sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-labelledby="nvb-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
          <div className="flex items-start justify-between gap-3 p-4 border-b border-zinc-800/80">
            <div className="min-w-0 flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <h2 id="nvb-title" className="text-lg font-semibold text-white tracking-tight">
                  Book viewing
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Choose a vehicle — you can schedule multiple appointments per unit; notes are saved on each booking.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!canBook ? (
            <div className="p-6 text-center text-zinc-400 text-sm">
              You don&apos;t have permission to create viewings (inventory edit role required).
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
              <div className="p-4 space-y-3 border-b border-zinc-800/60">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Car className="w-3 h-3" />
                  Vehicle
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" aria-hidden />
                  <input
                    type="search"
                    value={vehicleQuery}
                    onChange={(e) => setVehicleQuery(e.target.value)}
                    placeholder="Search stock ID, plate, brand, model…"
                    className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-sm text-white placeholder:text-zinc-600"
                    autoComplete="off"
                  />
                </div>

                <div className="relative">
                  <select
                    value={selectedId || ''}
                    onChange={(e) => setSelectedId(e.target.value || null)}
                    className={`w-full appearance-none rounded-lg bg-zinc-950 border px-4 py-2.5 pr-10 text-sm text-white outline-none cursor-pointer flex items-center gap-2 ${
                      selectedVehicle?.sold ? 'border-rose-700/80' : selectedVehicle?.reserved ? 'border-amber-600/60' : 'border-zinc-700 focus:ring-2 focus:ring-sky-500/40'
                    }`}
                    aria-label="Select vehicle"
                    disabled={vehiclesLoading || vehicles.length === 0}
                  >
                    <option value="">
                      {vehiclesLoading ? 'Loading vehicles…' : vehicles.length === 0 ? 'No vehicles' : 'Pick a vehicle…'}
                    </option>
                    {filteredVehicles.map((v) => {
                      const badge = `${v.stock_id ? `#${v.stock_id}` : 'No stock'} · ${v.plate_no || 'No plate'}`
                      const bookableRow = !v.sold && !v.reserved
                      return (
                        <option key={v.id} value={v.id} disabled={!bookableRow}>
                          {`${badge} — ${v.brand} ${v.model}`.trim()}
                          {v.viewing_count > 0 ? ` (${v.viewing_count} booked)` : ''}
                          {v.sold ? ' [Sold]' : v.reserved ? ' [Reserved]' : ''}
                        </option>
                      )
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                </div>

                {selectedVehicle ? (
                  <div
                    className={`rounded-xl border px-3 py-2.5 text-xs ${
                      selectedVehicle.sold
                        ? 'border-rose-500/35 bg-rose-500/5 text-rose-200/90'
                        : selectedVehicle.reserved
                          ? 'border-amber-500/35 bg-amber-500/5 text-amber-200/85'
                          : 'border-sky-500/35 bg-sky-500/5 text-sky-100/95'
                    }`}
                  >
                    <p className="font-medium flex items-center gap-2">
                      {bookable ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden />
                      ) : (
                        <X className="w-3.5 h-3.5 text-zinc-500 shrink-0" aria-hidden />
                      )}
                      {[selectedVehicle.brand, selectedVehicle.model].filter(Boolean).join(' ')}
                      <span className="text-zinc-500 font-normal">
                        {selectedVehicle.stock_id ? `#${selectedVehicle.stock_id}` : ''}
                        {selectedVehicle.plate_no ? ` · ${selectedVehicle.plate_no}` : ''}
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      {selectedVehicle.viewing_count > 0
                        ? `${selectedVehicle.viewing_count} viewing${selectedVehicle.viewing_count === 1 ? '' : 's'} already on this vehicle (each row stays separate).`
                        : 'No viewings yet for this vehicle — this will be the first.'}
                    </p>
                    {selectedVehicle.sold ? (
                      <p className="mt-2 text-rose-200/90">
                        Sold units stay read-only for viewings — open the record for history only.
                      </p>
                    ) : selectedVehicle.reserved ? (
                      <p className="mt-2 text-amber-200/85">
                        Reserved vehicles can&apos;t take new bookings from here (matches vehicle detail). Release the
                        reservation or edit on vehicle if needed.
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="inline-block mt-2 text-left text-sky-400 hover:text-sky-300 font-medium text-[11px]"
                        onClick={() => {
                          if (!selectedVehicle?.id) return
                          const path = `/vehicle/${selectedVehicle.id}?viewings=1`
                          onClose()
                          queueMicrotask(() => navigate(path))
                        }}
                      >
                        Open full viewing schedule on vehicle →
                      </button>
                    )}
                  </div>
                ) : null}
                {!vehicleQuery.trim() && vehicles.length > MAX_VEHICLE_ROWS ? (
                  <p className="text-[10px] text-zinc-600">
                    Showing first {MAX_VEHICLE_ROWS} vehicles — type to narrow the list ({vehicles.length} total).
                  </p>
                ) : null}
            </div>

            <div className="p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Customer name *</label>
                  <input
                    value={form.customer_name}
                    disabled={!bookable}
                    onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                    placeholder="e.g. Jane Smith"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Phone</label>
                  <input
                    value={form.customer_phone}
                    disabled={!bookable}
                    onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                    placeholder="Optional"
                    inputMode="tel"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={form.customer_email}
                    disabled={!bookable}
                    onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                    placeholder="Optional"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Date &amp; time *</label>
                  <input
                    type="datetime-local"
                    disabled={!bookable}
                    value={form.scheduled_local}
                    onChange={(e) => setForm((f) => ({ ...f, scheduled_local: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Comments / notes (saved on this viewing)
                  </label>
                  <textarea
                    value={form.notes}
                    disabled={!bookable}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white resize-y min-h-[4rem] disabled:opacity-50"
                    placeholder="e.g. Second visit; prefers evening; comparing with Jazz"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Message to team (notifications)
                  </label>
                  <textarea
                    value={form.staff_message}
                    disabled={!bookable}
                    onChange={(e) => setForm((f) => ({ ...f, staff_message: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white resize-y min-h-[3.5rem] disabled:opacity-50"
                    placeholder="e.g. Please have finance pack ready"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    id="nvb-notify-mgr"
                    disabled={!bookable}
                    type="checkbox"
                    checked={form.notify_managers}
                    onChange={(e) => setForm((f) => ({ ...f, notify_managers: e.target.checked }))}
                    className="rounded border-zinc-600 bg-zinc-900 text-amber-500 disabled:opacity-50"
                  />
                  <label htmlFor="nvb-notify-mgr" className="text-xs text-zinc-400">
                    Notify managers
                  </label>
                </div>
                {staffLoading ? (
                  <div className="sm:col-span-2 flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> Loading teammates…
                  </div>
                ) : staffOptions.length > 0 ? (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Mention teammates</p>
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 space-y-1.5">
                      {staffOptions.map((s) => (
                        <label
                          key={s.firebase_uid}
                          className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white"
                        >
                          <input
                            type="checkbox"
                            disabled={!bookable}
                            checked={form.mentionUids.includes(s.firebase_uid)}
                            onChange={() => toggleMention(s.firebase_uid)}
                            className="rounded border-zinc-600 bg-zinc-900 text-sky-500 disabled:opacity-50"
                          />
                          <span className="truncate">{s.display_name || s.email || s.firebase_uid}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 p-4 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!bookable || submitting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Save viewing
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  )
}
