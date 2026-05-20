import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  Loader2,
  Plus,
  Trash2,
  User,
  Phone,
  Mail,
  StickyNote,
  AtSign,
  Users,
  CalendarPlus,
  Download,
} from 'lucide-react'
import {
  buildViewingGoogleCalendarUrl,
  buildViewingIcsContent,
  downloadIcsFile,
} from '../lib/viewingCalendarLinks'
import {
  VIEWING_BOOKING_STATUSES,
  addVehicleViewingBooking,
  updateVehicleViewingBooking,
  removeVehicleViewingBooking,
  fetchAllUserProfiles,
} from '../lib/sanityData'
import { useNotification } from '../context/NotificationContext'

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  completed: 'Done',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

function fromDatetimeLocal(val) {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

/** Local date/time for list rows — weekday + granular fields only (mixing weekday with dateStyle/timeStyle breaks Intl in some browsers). */
function formatBookingScheduledAt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return d.toISOString()
  }
}

/** Value for `<input type="datetime-local">` from an ISO-ish string (local timezone). */
function toDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function RescheduleDatetimeEditor({ iso, bookingKey, busy, onApply }) {
  const [draft, setDraft] = useState(() => toDatetimeLocalValue(iso))
  useEffect(() => {
    setDraft(toDatetimeLocalValue(iso))
  }, [iso])
  const isoLocal = toDatetimeLocalValue(iso)
  const hasServerTime = Boolean(iso && isoLocal)
  const canSave = Boolean(draft.trim()) && draft !== isoLocal

  return (
    <div className="rounded-lg bg-zinc-950/80 border border-zinc-700/70 p-2.5 space-y-2">
      <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
        {hasServerTime ? 'Change date & time' : 'Set date & time'}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          className="w-full sm:flex-1 sm:min-w-[12rem] rounded-lg bg-zinc-950 border border-zinc-700 px-2 py-2 text-xs text-white"
        />
        <button
          type="button"
          disabled={busy || !canSave}
          onClick={() => onApply(bookingKey, draft)}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-medium transition shrink-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : null}
          Save time
        </button>
      </div>
      {!hasServerTime ? (
        <p className="text-[10px] text-amber-200/85">Choose a viewing time above, then tap Save time.</p>
      ) : null}
    </div>
  )
}

function sortBookings(list) {
  const arr = [...(list || [])]
  const rank = (s) => (s === 'scheduled' ? 0 : 1)
  arr.sort((a, b) => {
    const ra = rank(a.status)
    const rb = rank(b.status)
    if (ra !== rb) return ra - rb
    const ta = new Date(a.scheduled_at || 0).getTime()
    const tb = new Date(b.scheduled_at || 0).getTime()
    return ta - tb
  })
  return arr
}

export function ViewingBookingsPanel({
  vehicle,
  canEdit,
  currentUid = '',
  currentDisplayName = '',
  onUpdate,
  showHeader = true,
}) {
  const { addNotification } = useNotification()
  const [submitting, setSubmitting] = useState(false)
  const [updatingKey, setUpdatingKey] = useState(null)
  const [staffOptions, setStaffOptions] = useState([])
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    scheduled_local: '',
    notes: '',
    staff_message: '',
    notify_managers: true,
    mentionUids: [],
  })

  const needsStaffDirectory = useMemo(() => {
    if (canEdit && !vehicle?.sold) return true
    return (vehicle?.viewing_bookings || []).some((b) => (b.mentioned_firebase_uids || []).length > 0)
  }, [canEdit, vehicle?.sold, vehicle?.viewing_bookings])

  useEffect(() => {
    let cancelled = false
    if (!needsStaffDirectory) {
      setStaffOptions([])
      return
    }
    ;(async () => {
      try {
        const rows = await fetchAllUserProfiles()
        if (cancelled) return
        const filtered = (rows || []).filter((r) => r.firebase_uid && r.firebase_uid !== currentUid)
        setStaffOptions(filtered)
      } catch {
        if (!cancelled) setStaffOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [needsStaffDirectory, vehicle?.id, currentUid])

  const bookings = useMemo(() => sortBookings(vehicle?.viewing_bookings), [vehicle?.viewing_bookings])
  const sold = vehicle?.sold
  const reserved = vehicle?.reserved
  const allowAdd = canEdit && !sold && !reserved

  function toggleMention(uid) {
    setForm((f) => {
      const set = new Set(f.mentionUids)
      if (set.has(uid)) set.delete(uid)
      else set.add(uid)
      return { ...f, mentionUids: [...set] }
    })
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!vehicle?.id || !allowAdd) return
    const scheduled_at = fromDatetimeLocal(form.scheduled_local)
    if (!scheduled_at) {
      addNotification('Pick a date and time for the viewing', 'error')
      return
    }
    setSubmitting(true)
    try {
      await addVehicleViewingBooking(
        vehicle.id,
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
        { uid: currentUid, displayName: currentDisplayName }
      )
      addNotification('Viewing booked', 'success')
      setForm({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        scheduled_local: '',
        notes: '',
        staff_message: '',
        notify_managers: true,
        mentionUids: [],
      })
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Could not save booking', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function patchStatus(key, status) {
    if (!vehicle?.id || !canEdit) return
    setUpdatingKey(key)
    try {
      await updateVehicleViewingBooking(vehicle.id, key, { status })
      addNotification('Booking updated', 'success')
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Update failed', 'error')
    } finally {
      setUpdatingKey(null)
    }
  }

  async function patchScheduledAt(key, scheduledLocal) {
    if (!vehicle?.id || !canEdit || sold) return
    const scheduled_at = fromDatetimeLocal(scheduledLocal)
    if (!scheduled_at) {
      addNotification('Pick a valid date and time', 'error')
      return
    }
    setUpdatingKey(key)
    try {
      await updateVehicleViewingBooking(vehicle.id, key, { scheduled_at })
      addNotification('Viewing time updated', 'success')
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Could not reschedule', 'error')
    } finally {
      setUpdatingKey(null)
    }
  }

  async function handleRemove(key) {
    if (!vehicle?.id || !canEdit) return
    if (!confirm('Remove this viewing appointment?')) return
    setUpdatingKey(key)
    try {
      await removeVehicleViewingBooking(vehicle.id, key)
      addNotification('Booking removed', 'success')
      onUpdate?.()
    } catch (err) {
      addNotification(err.message || 'Could not remove', 'error')
    } finally {
      setUpdatingKey(null)
    }
  }

  return (
    <div
      className={
        showHeader
          ? 'rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden'
          : ''
      }
    >
      {showHeader ? (
        <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/80 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white tracking-tight">Viewing appointments</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Book visits, add a team message, @mention colleagues, and optionally notify managers.
            </p>
          </div>
        </div>
      ) : null}

      <div className={`p-4 space-y-3 ${!showHeader ? 'pt-0' : ''}`}>
        {bookings.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">No viewings booked yet.</p>
        ) : (
          bookings.map((b) => {
            const busy = updatingKey === b.id
            const st = b.status || 'scheduled'
            const isPast =
              st === 'scheduled' && b.scheduled_at && new Date(b.scheduled_at).getTime() < Date.now()
            const mentionNames = (b.mentioned_firebase_uids || [])
              .map((uid) => staffOptions.find((s) => s.firebase_uid === uid)?.display_name || uid.slice(0, 6))
              .filter(Boolean)
            return (
              <div
                key={b.id}
                className={`rounded-lg border p-3 ${
                  st === 'scheduled'
                    ? isPast
                      ? 'border-amber-500/35 bg-amber-500/5'
                      : 'border-sky-500/30 bg-sky-500/5'
                    : st === 'completed'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-zinc-700/80 bg-zinc-800/30'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      {b.customer_name || 'Customer'}
                    </p>
                    <p className="text-xs text-sky-300/90 mt-1 font-medium">
                      {formatBookingScheduledAt(b.scheduled_at)}
                    </p>
                    {(b.customer_phone || b.customer_email) && (
                      <div className="mt-2 space-y-0.5 text-xs text-zinc-400">
                        {b.customer_phone ? (
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 shrink-0 text-zinc-600" />
                            {b.customer_phone}
                          </p>
                        ) : null}
                        {b.customer_email ? (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 shrink-0 text-zinc-600" />
                            {b.customer_email}
                          </p>
                        ) : null}
                      </div>
                    )}
                    {b.notes ? (
                      <p className="text-xs text-zinc-500 mt-2 flex gap-1.5">
                        <StickyNote className="w-3 h-3 shrink-0 mt-0.5 text-zinc-600" />
                        {b.notes}
                      </p>
                    ) : null}
                    {b.staff_message ? (
                      <p className="text-xs text-amber-200/80 mt-2 flex gap-1.5">
                        <AtSign className="w-3 h-3 shrink-0 mt-0.5 text-amber-500/70" />
                        <span>
                          <span className="text-zinc-500">Team: </span>
                          {b.staff_message}
                        </span>
                      </p>
                    ) : null}
                    {mentionNames.length > 0 ? (
                      <p className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Mentioned: {mentionNames.join(', ')}
                      </p>
                    ) : null}
                    {b.notify_managers === false ? (
                      <p className="text-[10px] text-zinc-600 mt-1">Managers not notified for this booking</p>
                    ) : null}
                    {st === 'scheduled' && b.scheduled_at ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(() => {
                          const stock =
                            vehicle.stock_id != null && vehicle.stock_id !== ''
                              ? `#${vehicle.stock_id}`
                              : 'Vehicle'
                          const title = `Viewing: ${vehicle.brand || ''} ${vehicle.model || ''} (${stock})`.trim()
                          const details = [
                            `Customer: ${b.customer_name || '—'}`,
                            b.customer_phone && `Phone: ${b.customer_phone}`,
                            b.customer_email && `Email: ${b.customer_email}`,
                            b.notes && `Notes: ${b.notes}`,
                          ]
                            .filter(Boolean)
                            .join('\n')
                          const gUrl = buildViewingGoogleCalendarUrl({
                            title,
                            details,
                            location: '',
                            isoStart: b.scheduled_at,
                            durationMinutes: 60,
                          })
                          const ics = buildViewingIcsContent({
                            uid: `${vehicle.id}-${b.id}`,
                            title,
                            description: details,
                            location: '',
                            isoStart: b.scheduled_at,
                            durationMinutes: 60,
                            attendeeEmail: b.customer_email,
                          })
                          return (
                            <>
                              {gUrl ? (
                                <a
                                  href={gUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-400 hover:text-sky-300 border border-sky-500/40 rounded-md px-2 py-1 bg-sky-500/10"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <CalendarPlus className="w-3 h-3" />
                                  Google Calendar
                                </a>
                              ) : null}
                              {ics ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    downloadIcsFile(
                                      `viewing-${vehicle.stock_id || vehicle.id}-${b.id}`,
                                      ics
                                    )
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-300 hover:text-white border border-zinc-600 rounded-md px-2 py-1 bg-zinc-800/80"
                                >
                                  <Download className="w-3 h-3" />
                                  Download .ics
                                </button>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
                        st === 'scheduled'
                          ? isPast
                            ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                            : 'text-sky-400 border-sky-500/40 bg-sky-500/10'
                          : st === 'completed'
                            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                            : 'text-zinc-400 border-zinc-600 bg-zinc-800/60'
                      }`}
                    >
                      {STATUS_LABEL[st] || st}
                    </span>
                    {canEdit && !sold ? (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <select
                          value={st}
                          disabled={busy}
                          onChange={(e) => patchStatus(b.id, e.target.value)}
                          className="text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1.5 max-w-[9.5rem]"
                        >
                          {VIEWING_BOOKING_STATUSES.map((code) => (
                            <option key={code} value={code}>
                              {STATUS_LABEL[code]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRemove(b.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition"
                          title="Remove booking"
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {st === 'scheduled' && canEdit && !sold ? (
                  <div className="mt-3 pt-3 border-t border-zinc-800/70 w-full min-w-0">
                    <RescheduleDatetimeEditor
                      iso={b.scheduled_at}
                      bookingKey={b.id}
                      busy={busy}
                      onApply={patchScheduledAt}
                    />
                  </div>
                ) : null}
                {st === 'scheduled' && !canEdit && !sold ? (
                  <div className="mt-3 pt-3 border-t border-zinc-800/70 w-full">
                    <p className="text-[10px] leading-relaxed text-zinc-500">
                      You don&apos;t have permission to change status or time — ask someone with inventory edit access to
                      reschedule if needed.
                    </p>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      {allowAdd ? (
        <form onSubmit={handleAdd} className="border-t border-zinc-800/60 p-4 bg-zinc-900/40 space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Book another viewing</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Customer name *</label>
              <input
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white"
                placeholder="e.g. Jane Smith"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Phone</label>
              <input
                value={form.customer_phone}
                onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white"
                placeholder="Optional"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={form.customer_email}
                onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white"
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Date & time *</label>
              <input
                type="datetime-local"
                value={form.scheduled_local}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_local: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Notes (customer / internal)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white resize-y min-h-[4rem]"
                placeholder="e.g. Wants to bring partner; prefers afternoon"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Message to team (shown in notifications)
              </label>
              <textarea
                value={form.staff_message}
                onChange={(e) => setForm((f) => ({ ...f, staff_message: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-white resize-y min-h-[3.5rem]"
                placeholder="e.g. Please have keys ready; customer asking about finance"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="notify-mgr"
                type="checkbox"
                checked={form.notify_managers}
                onChange={(e) => setForm((f) => ({ ...f, notify_managers: e.target.checked }))}
                className="rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/40"
              />
              <label htmlFor="notify-mgr" className="text-xs text-zinc-400">
                Notify managers (users who can delete vehicles or manage users)
              </label>
            </div>
            {staffOptions.length > 0 ? (
              <div className="sm:col-span-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Mention teammates</p>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 space-y-1.5">
                  {staffOptions.map((s) => (
                    <label
                      key={s.firebase_uid}
                      className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={form.mentionUids.includes(s.firebase_uid)}
                        onChange={() => toggleMention(s.firebase_uid)}
                        className="rounded border-zinc-600 bg-zinc-900 text-sky-500 focus:ring-sky-500/40"
                      />
                      <span className="truncate">{s.display_name || s.email || s.firebase_uid}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 mt-1">
                  Selected people get a notification with your team message.
                </p>
              </div>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium disabled:opacity-50 transition"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add viewing
          </button>
        </form>
      ) : sold ? (
        <p className="text-xs text-zinc-500 px-4 pb-4">Sold vehicles: viewing history is read-only.</p>
      ) : reserved ? (
        <p className="text-xs text-amber-500/80 px-4 pb-4">
          This vehicle is reserved — new viewings are turned off here. Past rows stay for reference.
        </p>
      ) : null}
    </div>
  )
}
