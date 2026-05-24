import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { CalendarClock, Car, CheckCircle, ChevronLeft, ChevronRight, Loader2, Lock, Package, X } from 'lucide-react'
import { fetchVehiclePublicById, fetchPublicBookingAlternatesByModel } from '../lib/sanityData'
import { submitPublicViewingBooking } from '../lib/publicViewingBooking'
import {
  sanitizeCustomerEmail,
  sanitizeCustomerPhone,
  sanitizeCustomerPlainText,
} from '../lib/sanitizeCustomerInput'
import { LazyVehicleImage } from '../components/LazyVehicleImage'
import { PublicVehicleFeaturesChips } from '../components/PublicVehicleFeaturesChips'
import { LoadingState } from '../components/LoadingState'
import { Footer } from '../components/Footer'
import { useNotification } from '../context/NotificationContext'
import {
  publicBookingTimeSlotsForDay,
  isPublicBookingDaySelectable,
} from '../lib/publicBookingHours'
import { formatPublicSellingPriceGbp } from '../lib/publicVehicleDisplay'

const BOOKING_FN_CONFIGURED = Boolean(String(import.meta.env.VITE_PUBLIC_VIEWING_BOOKING_URL || '').trim())

function startOfLocalDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function buildSlotIso(selectedDay, slot) {
  const d = startOfLocalDay(selectedDay)
  d.setHours(Number(slot.hour), Number(slot.minute), 0, 0)
  return d.toISOString()
}

function digitCount(s) {
  return (String(s || '').match(/\d/g) || []).length
}

export function PublicVehicleBook() {
  const { id } = useParams()
  const { addNotification } = useNotification()
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(undefined)
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  /** Bot trap — must stay empty */
  const [hpCompany, setHpCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookedOk, setBookedOk] = useState(false)
  const [similar, setSimilar] = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const carouselRef = useRef(null)
  const [carouselOverflows, setCarouselOverflows] = useState(false)

  const todayStart = useMemo(() => startOfLocalDay(new Date()), [modalOpen])
  const maxDay = useMemo(() => {
    const m = new Date()
    m.setDate(m.getDate() + 60)
    m.setHours(0, 0, 0, 0)
    return m
  }, [])

  const reload = useCallback(async () => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setNotFound(false)
    try {
      const v = await fetchVehiclePublicById(id)
      if (!v) {
        setNotFound(true)
        setVehicle(null)
      } else {
        setVehicle(v)
      }
    } catch {
      setNotFound(true)
      setVehicle(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  const slotsForDay = useMemo(() => publicBookingTimeSlotsForDay(selectedDate), [selectedDate])

  useEffect(() => {
    setSelectedSlotId((prev) => {
      const slots = publicBookingTimeSlotsForDay(selectedDate)
      if (prev && slots.some((s) => s.id === prev)) return prev
      return null
    })
  }, [selectedDate])

  useEffect(() => {
    if (!vehicle?.id || !vehicle.brand || !vehicle.model) {
      setSimilar([])
      setSimilarLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setSimilarLoading(true)
      try {
        const rows = await fetchPublicBookingAlternatesByModel(vehicle.id, vehicle.brand, vehicle.model, 20)
        if (!cancelled) setSimilar(rows || [])
      } catch {
        if (!cancelled) setSimilar([])
      } finally {
        if (!cancelled) setSimilarLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vehicle])

  const scrollCarousel = useCallback((direction) => {
    const el = carouselRef.current
    if (!el) return
    const w = Math.min(el.clientWidth * 0.8, 260)
    el.scrollBy({ left: direction * w, behavior: 'smooth' })
  }, [])

  const measureCarouselOverflow = useCallback(() => {
    const el = carouselRef.current
    if (!el) {
      setCarouselOverflows(false)
      return
    }
    setCarouselOverflows(el.scrollWidth > Math.ceil(el.clientWidth) + 2)
  }, [])

  useLayoutEffect(() => {
    measureCarouselOverflow()
  }, [similar, similarLoading, measureCarouselOverflow])

  useEffect(() => {
    const el = carouselRef.current
    if (!el || similar.length === 0) return undefined
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measureCarouselOverflow()) : null
    ro?.observe(el)
    el.addEventListener('scroll', measureCarouselOverflow, { passive: true })
    window.addEventListener('resize', measureCarouselOverflow)
    measureCarouselOverflow()
    return () => {
      ro?.disconnect()
      el.removeEventListener('scroll', measureCarouselOverflow)
      window.removeEventListener('resize', measureCarouselOverflow)
    }
  }, [similar, measureCarouselOverflow])

  const isSold = vehicle?.sold
  const isReserved = vehicle?.reserved && !vehicle?.sold
  const canBook = vehicle && !isSold && !isReserved

  function openModal() {
    if (!canBook || !BOOKING_FN_CONFIGURED) return
    setBookedOk(false)
    setSelectedDate(undefined)
    setSelectedSlotId(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!id || !canBook || !BOOKING_FN_CONFIGURED || submitting) return

    const nameClean = sanitizeCustomerPlainText(customerName, 120)
    const phoneClean = sanitizeCustomerPhone(customerPhone, 40)
    const emailClean = sanitizeCustomerEmail(customerEmail, 160)
    const notesClean = sanitizeCustomerPlainText(notes, 1200)

    if (nameClean.length < 2) {
      addNotification('Please enter your name (at least 2 characters).', 'error')
      return
    }
    if (digitCount(phoneClean) < 7) {
      addNotification('Please enter a valid phone number we can reach you on.', 'error')
      return
    }
    if (!selectedDate) {
      addNotification('Choose a day from the calendar.', 'error')
      return
    }
    if (!selectedSlotId) {
      addNotification('Pick one of the available times.', 'error')
      return
    }
    const slot = slotsForDay.find((s) => s.id === selectedSlotId)
    if (!slot) return

    const scheduled_at = buildSlotIso(selectedDate, slot)

    setSubmitting(true)
    try {
      await submitPublicViewingBooking({
        vehicleId: id,
        customer_name: nameClean,
        customer_phone: phoneClean,
        customer_email: emailClean,
        notes: notesClean,
        scheduled_at,
        hp_company: hpCompany,
      })
      setBookedOk(true)
      addNotification('Request sent — the team will confirm your viewing.', 'success')
      setModalOpen(false)
      setSelectedDate(undefined)
      setSelectedSlotId(null)
      setCustomerName('')
      setCustomerPhone('')
      setCustomerEmail('')
      setNotes('')
      setHpCompany('')
    } catch (err) {
      addNotification(err.message || 'Could not submit. Try again or call us.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <LoadingState message="Loading vehicle…" variant="embedded" className="py-24" />
      </div>
    )
  }

  if (notFound || !vehicle) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <header className="border-b border-zinc-800 px-4 py-4">
          <Link to="/find" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            ← Back to stock
          </Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center pb-24">
          <Car className="w-14 h-14 text-zinc-600 mb-4" />
          <p className="text-lg font-medium text-zinc-300">Vehicle not found</p>
          <p className="text-zinc-500 text-sm mt-1 max-w-md">The link may be wrong or this listing may have been removed.</p>
          <Link
            to="/find"
            className="mt-6 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm"
          >
            Browse stock
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  const primaryImage = vehicle.images?.[0]?.url
  const listedPriceLabel = formatPublicSellingPriceGbp(vehicle.selling_price)

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col public-book-page">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to={`/find/vehicle/${encodeURIComponent(vehicle.id)}`} className="text-sm text-zinc-400 hover:text-white shrink-0">
            ← Vehicle summary
          </Link>
          <Link to="/find" className="text-xs text-zinc-500 hover:text-zinc-300">
            All stock
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 pt-5 pb-4 flex-1 flex flex-col gap-4">
        <div className="rounded-2xl border border-sky-500/35 bg-gradient-to-br from-sky-500/10 to-zinc-900/60 p-4 sm:p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0 border border-sky-500/30">
              <CalendarClock className="w-5 h-5 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-white leading-tight">Book a viewing</h1>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                Mon–Sat <span className="text-zinc-300">10am–7pm</span>, Sun{' '}
                <span className="text-zinc-300">12:30pm–3:30pm</span> (half-hour slots). Times shown in your device&apos;s
                timezone; we&apos;ll confirm with you before you arrive.
              </p>
            </div>
          </div>

          {!canBook ? (
            <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {isSold
                ? 'This vehicle has been sold, so online booking is closed.'
                : 'This vehicle is reserved — online booking isn’t available. Please browse other stock or contact us.'}
            </div>
          ) : null}

          {bookedOk && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" aria-hidden />
              <p>
                Thanks — your viewing request has been saved. Someone from the dealership will contact you to confirm or
                adjust the time.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={!canBook || !BOOKING_FN_CONFIGURED}
            onClick={openModal}
            className="mt-5 w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition shadow-md shadow-sky-900/40"
          >
            {canBook ? (BOOKING_FN_CONFIGURED ? 'Choose date & time' : 'Online booking unavailable') : 'Booking unavailable'}
          </button>

          {canBook && !BOOKING_FN_CONFIGURED && (
            <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
              Online booking isn&apos;t switched on yet. Please call or message the showroom and we&apos;ll arrange a viewing.
            </p>
          )}
          {import.meta.env.DEV && canBook && !BOOKING_FN_CONFIGURED && (
            <p className="mt-1.5 text-[10px] text-zinc-600 font-mono">
              Dev: add VITE_PUBLIC_VIEWING_BOOKING_URL and deploy submitPublicViewingBooking (functions/README.md).
            </p>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40">
          <div className="aspect-[4/3] bg-zinc-950 relative">
            <LazyVehicleImage
              src={primaryImage}
              alt={`${vehicle.brand} ${vehicle.model}`}
              className="absolute inset-0 w-full h-full"
              imgClassName="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
            {isSold && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-rose-600/95 text-white text-xs font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Sold
              </div>
            )}
            {isReserved && !isSold && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-amber-600/95 text-white text-xs font-semibold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Reserved
              </div>
            )}
            {!isSold && !isReserved && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-emerald-600/95 text-zinc-950 text-xs font-semibold flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> Available
              </div>
            )}
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-white font-semibold text-xl">
                {vehicle.brand} {vehicle.model}
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                {vehicle.stock_id != null && vehicle.stock_id !== '' && (
                  <p className="text-amber-400/95 font-mono text-sm">#{vehicle.stock_id}</p>
                )}
                {listedPriceLabel ? (
                  <p className="text-emerald-300 font-semibold text-base drop-shadow">{listedPriceLabel}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3 text-sm mb-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">About this vehicle</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-zinc-300">
            {vehicle.model_year != null && vehicle.model_year !== '' && (
              <>
                <dt className="text-zinc-500">Year</dt>
                <dd>{vehicle.model_year}</dd>
              </>
            )}
            {listedPriceLabel ? (
              <>
                <dt className="text-zinc-500">Price</dt>
                <dd className="font-semibold text-emerald-300">{listedPriceLabel}</dd>
              </>
            ) : null}
            {vehicle.mileage != null && (
              <>
                <dt className="text-zinc-500">Mileage</dt>
                <dd>{Number(vehicle.mileage).toLocaleString()} miles</dd>
              </>
            )}
            {vehicle.cc != null && vehicle.cc !== '' && (
              <>
                <dt className="text-zinc-500">Engine capacity</dt>
                <dd>
                  {typeof vehicle.cc === 'number'
                    ? vehicle.cc.toLocaleString('en-GB')
                    : String(vehicle.cc).trim()}{' '}
                  cc
                </dd>
              </>
            )}
            {vehicle.fuel_type && (
              <>
                <dt className="text-zinc-500">Fuel</dt>
                <dd>{vehicle.fuel_type}</dd>
              </>
            )}
            {vehicle.gear && (
              <>
                <dt className="text-zinc-500">Gearbox</dt>
                <dd>{vehicle.gear}</dd>
              </>
            )}
            {vehicle.body && (
              <>
                <dt className="text-zinc-500">Body</dt>
                <dd>{vehicle.body}</dd>
              </>
            )}
            {vehicle.color && (
              <>
                <dt className="text-zinc-500">Colour</dt>
                <dd>{vehicle.color}</dd>
              </>
            )}
            {vehicle.plate_no && String(vehicle.plate_no).trim() !== '' && (
              <>
                <dt className="text-zinc-500">Number plate</dt>
                <dd className="font-mono tracking-wide">{vehicle.plate_no}</dd>
              </>
            )}
          </dl>
          <PublicVehicleFeaturesChips features={vehicle.features} />
          {vehicle.details && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-zinc-500 text-xs uppercase mb-1">Notes</p>
              <p className="text-zinc-400 whitespace-pre-wrap text-sm leading-relaxed">{vehicle.details}</p>
            </div>
          )}
        </div>

        {(similarLoading || similar.length > 0) && (
          <section className="mt-6 mb-2" aria-labelledby="similar-models-heading">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 id="similar-models-heading" className="text-sm font-semibold text-white tracking-tight">
                  More available {vehicle.brand} {vehicle.model}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">Tap a car to pick another slot · same model lineup</p>
              </div>
              {carouselOverflows && !similarLoading ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => scrollCarousel(-1)}
                    className="p-2 rounded-lg border border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                    aria-label="Previous cars"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel(1)}
                    className="p-2 rounded-lg border border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                    aria-label="Next cars"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
            {similarLoading ? (
              <div className="flex gap-3 overflow-hidden pb-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-[9.25rem] w-[11rem] shrink-0 rounded-xl bg-zinc-800/90 animate-pulse border border-zinc-800" />
                ))}
              </div>
            ) : (
              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-auto pb-2 scroll-smooth scrollbar-hide snap-x snap-mandatory -mx-1 px-1"
              >
                {similar.map((s) => {
                  const img = s.images?.[0]?.url
                  const label = `${s.brand} ${s.model}`
                  const sub =
                    [
                      s.model_year != null && s.model_year !== '' ? String(s.model_year) : null,
                      s.mileage != null ? `${Number(s.mileage).toLocaleString()} mi` : null,
                      s.stock_id ? `#${s.stock_id}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'View & book'

                  return (
                    <Link
                      key={s.id}
                      to={`/book/vehicle/${encodeURIComponent(s.id)}`}
                      className="group shrink-0 w-[11rem] snap-start rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 hover:border-sky-500/40 hover:bg-zinc-900 transition shadow-sm flex flex-col"
                    >
                      <div className="aspect-[4/3] bg-zinc-950 relative overflow-hidden">
                        <LazyVehicleImage
                          src={img}
                          alt={label}
                          className="absolute inset-0 w-full h-full"
                          imgClassName="object-cover transition group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2">{label}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{sub}</p>
                        </div>
                      </div>
                      <div className="px-2.5 py-2 border-t border-zinc-800/80 flex items-center justify-center">
                        <span className="text-[11px] font-medium text-sky-400 group-hover:text-sky-300">Book this one</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <Footer />

      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
          role="presentation"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-modal-title"
            className="w-full sm:max-w-md max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
              <h2 id="book-modal-title" className="text-base font-semibold text-white">
                Request a viewing
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col relative">
              <div className="p-4 space-y-4 customer-booking-calendar">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Mon–Sat use full-day hours below; Sundays use shortened hours. Slots are every 30 minutes during
                  opening hours.
                </p>

                <div className="flex justify-center rounded-xl border border-zinc-800 bg-zinc-950/80 p-2">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={[
                      { before: todayStart },
                      { after: maxDay },
                      (day) => !isPublicBookingDaySelectable(day),
                    ]}
                    showOutsideDays
                    fixedWeeks
                  />
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Time</p>
                  {!selectedDate ? (
                    <p className="text-xs text-zinc-500">Pick a date above to load available times.</p>
                  ) : slotsForDay.length === 0 ? (
                    <p className="text-xs text-zinc-500">That day isn’t available.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                      {slotsForDay.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSlotId(s.id)}
                          className={`rounded-lg border px-1.5 py-2 text-center text-xs font-medium transition ${
                            selectedSlotId === s.id
                              ? 'border-sky-500 bg-sky-500/15 text-sky-200'
                              : 'border-zinc-700 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Your name *</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={130}
                    autoComplete="name"
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600"
                    placeholder="e.g. Sam Taylor"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Phone *</label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    maxLength={45}
                    autoComplete="tel"
                    inputMode="tel"
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600"
                    placeholder="So we can confirm your visit"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Email (optional)</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    maxLength={170}
                    autoComplete="email"
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Message (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={1250}
                    rows={3}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 resize-y min-h-[4.5rem]"
                    placeholder="Anything we should know (no links required)"
                  />
                </div>

                {/* Honeypot — hidden from users; bots often fill visible-offscreen fields */}
                <div className="absolute -left-[9999px] top-0 opacity-0 w-px h-px overflow-hidden" aria-hidden="true">
                  <label htmlFor="hp-company">Company</label>
                  <input
                    id="hp-company"
                    tabIndex={-1}
                    autoComplete="off"
                    value={hpCompany}
                    onChange={(e) => setHpCompany(e.target.value)}
                  />
                </div>
              </div>

              <div className="border-t border-zinc-800 p-4 flex gap-2 shrink-0 bg-zinc-900/90">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl border border-zinc-600 text-zinc-300 text-sm font-medium hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Send request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
