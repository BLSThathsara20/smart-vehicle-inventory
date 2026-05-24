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
  const mainBookBtnRef = useRef(null)
  const [carouselOverflows, setCarouselOverflows] = useState(false)
  const [fabBookVisible, setFabBookVisible] = useState(false)

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

  /** Floating book control when primary button scrolls out of view */
  useEffect(() => {
    if (!canBook || modalOpen || loading) {
      setFabBookVisible(false)
      return undefined
    }
    const el = mainBookBtnRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => {
      const vis = typeof e?.isIntersecting === 'boolean' ? e.isIntersecting : true
      setFabBookVisible(!vis)
    }, { root: null, threshold: 0, rootMargin: '16px 0px 16px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [canBook, modalOpen, loading, vehicle?.id])

  function openModal() {
    if (!canBook) return
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
    if (!id || !canBook || submitting) return

    if (!BOOKING_FN_CONFIGURED) {
      addNotification('Booking not online yet — please phone us with your date & time.', 'error')
      return
    }

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
      addNotification("Sent — we'll phone you.", 'success')
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
      <div className="min-h-[100dvh] min-h-screen bg-zinc-950 overflow-x-hidden public-customer-flow">
        <LoadingState message="Loading vehicle…" variant="embedded" className="py-24" />
      </div>
    )
  }

  if (notFound || !vehicle) {
    return (
      <div className="min-h-[100dvh] min-h-screen bg-zinc-950 text-white flex flex-col overflow-x-hidden public-customer-flow">
        <header className="border-b border-zinc-800 px-4 safe-area-header shrink-0">
          <Link
            to="/find"
            className="inline-flex items-center gap-2 min-h-12 py-3 text-base text-zinc-400 hover:text-white touch-manipulation"
          >
            ← Back to stock
          </Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] text-center pb-12">
          <Car className="w-14 h-14 text-zinc-600 mb-4" />
          <p className="text-lg font-medium text-zinc-300">Vehicle not found</p>
          <p className="text-zinc-500 text-sm mt-1 max-w-md">The link may be wrong or this listing may have been removed.</p>
          <Link
            to="/find"
            className="mt-8 inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-base touch-manipulation"
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
    <div className="min-h-[100dvh] min-h-screen bg-zinc-950 text-white flex flex-col overflow-x-hidden public-customer-flow public-book-page">
      <header className="sticky top-0 z-40 safe-area-header border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-2 sm:py-3 flex items-center justify-between gap-3 min-h-[48px]">
          <Link
            to={`/find/vehicle/${encodeURIComponent(vehicle.id)}`}
            className="text-sm sm:text-base text-zinc-400 hover:text-white shrink-0 min-h-[44px] inline-flex items-center px-1 -mx-1 touch-manipulation rounded-lg active:bg-zinc-800/80"
          >
            ← Vehicle summary
          </Link>
          <Link
            to="/find"
            className="text-sm text-zinc-500 hover:text-zinc-300 min-h-[44px] inline-flex items-center px-2 touch-manipulation rounded-lg active:bg-zinc-800/60"
          >
            All stock
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 pb-2 flex-1 flex flex-col gap-4">
        <div className="rounded-2xl border border-sky-500/35 bg-gradient-to-br from-sky-500/10 to-zinc-900/60 p-4 sm:p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0 border border-sky-500/30">
              <CalendarClock className="w-5 h-5 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-white leading-tight">Book a viewing</h1>
              <p className="text-zinc-400 mt-2 text-[15px] leading-snug">
                Mon–Sat <span className="text-zinc-200 font-medium">10am–7pm</span> · Sun{' '}
                <span className="text-zinc-200 font-medium">12:30pm–3:30pm</span>.
              </p>
            </div>
          </div>

          {!canBook ? (
            <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {isSold ? 'Sold — not bookable.' : 'Reserved — not bookable.'}
            </div>
          ) : null}

          {bookedOk && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" aria-hidden />
              <p>Request received. We&apos;ll confirm by phone.</p>
            </div>
          )}

          <button
            ref={mainBookBtnRef}
            type="button"
            disabled={!canBook}
            onClick={openModal}
            className="mt-5 w-full min-h-[52px] py-4 sm:py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base transition shadow-md shadow-sky-900/40 touch-manipulation"
          >
            {canBook ? 'Choose date & time' : 'Not available'}
          </button>

          {import.meta.env.DEV && canBook && !BOOKING_FN_CONFIGURED ? (
            <p className="mt-2 text-[10px] text-zinc-600 font-mono leading-snug">Dev: set VITE_PUBLIC_VIEWING_BOOKING_URL to submit.</p>
          ) : null}
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
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Details</p>
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
                <h2 id="similar-models-heading" className="text-base font-semibold text-white tracking-tight">
                  Same model · other cars
                </h2>
              </div>
              {carouselOverflows && !similarLoading ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => scrollCarousel(-1)}
                    className="min-h-11 min-w-11 shrink-0 flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 text-zinc-300 active:bg-zinc-800 hover:text-white transition touch-manipulation"
                    aria-label="Previous cars"
                  >
                    <ChevronLeft className="w-5 h-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel(1)}
                    className="min-h-11 min-w-11 shrink-0 flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/80 text-zinc-300 active:bg-zinc-800 hover:text-white transition touch-manipulation"
                    aria-label="Next cars"
                  >
                    <ChevronRight className="w-5 h-5" aria-hidden />
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
                className="flex gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth scrollbar-hide snap-x snap-mandatory -mx-1 px-[max(0.25rem,env(safe-area-inset-left))] touch-pan-x"
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
                      className="group shrink-0 w-[min(11rem,calc(100vw-2.5rem))] min-w-[10.5rem] snap-start rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 active:border-sky-500/45 hover:border-sky-500/40 hover:bg-zinc-900 transition shadow-sm flex flex-col touch-manipulation"
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
                          <p className="text-[12px] font-semibold text-white leading-snug line-clamp-2">{label}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{sub}</p>
                        </div>
                      </div>
                      <div className="px-2.5 py-3 border-t border-zinc-800/80 flex items-center justify-center min-h-[44px]">
                        <span className="text-xs font-semibold text-sky-400 group-hover:text-sky-300 group-active:text-sky-200">
                          Book this one
                        </span>
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

      {canBook && !modalOpen && (
        <button
          type="button"
          onClick={openModal}
          aria-label="Book a viewing"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.25rem)',
            right: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
          className={`fixed z-[85] hidden min-h-14 touch-manipulation items-center gap-2 rounded-2xl border border-white/15 bg-sky-600 px-5 py-3 font-semibold text-[15px] text-white shadow-2xl shadow-black/35 transition-all duration-300 ease-out md:flex md:-translate-x-0 ${
            fabBookVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
          }`}
        >
          <CalendarClock className="h-6 w-6 shrink-0" aria-hidden />
          Book visit
        </button>
      )}

      {canBook && !modalOpen && (
        <button
          type="button"
          onClick={openModal}
          aria-label="Book a viewing"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.125rem)',
            left: '50%',
          }}
          className={`fixed z-[85] inline-flex min-h-14 max-w-[min(22rem,calc(100vw-2rem))] min-w-[10.5rem] -translate-x-1/2 touch-manipulation items-center justify-center gap-2 rounded-full border border-white/15 bg-sky-600 px-6 py-3.5 font-semibold text-[15px] text-white shadow-2xl shadow-black/35 transition-all duration-300 ease-out md:hidden ${
            fabBookVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
          }`}
        >
          <CalendarClock className="h-6 w-6 shrink-0" aria-hidden />
          Book visit
        </button>
      )}

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
            className="flex h-[92dvh] max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.25rem] border border-zinc-700 bg-zinc-900 shadow-2xl sm:h-auto sm:max-h-[min(88vh,40rem)] sm:max-w-md sm:rounded-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 pl-4 pr-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-3">
              <h2 id="book-modal-title" className="pl-1 text-lg font-semibold text-white">
                Book a viewing
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="min-h-11 min-w-11 shrink-0 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white touch-manipulation"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="customer-booking-calendar relative flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-4 pt-4">
                <div className="flex justify-center overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-2">
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
                  <p className="mb-2 text-[13px] font-semibold text-zinc-300">Time</p>
                  {!selectedDate ? (
                    <p className="text-[15px] text-zinc-500">Tap a date first.</p>
                  ) : slotsForDay.length === 0 ? (
                    <p className="text-[15px] text-zinc-500">Pick another day.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {slotsForDay.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedSlotId(s.id)}
                          className={`min-h-[48px] rounded-xl border px-2 py-3 text-center text-sm font-semibold transition touch-manipulation ${
                            selectedSlotId === s.id
                              ? 'border-sky-500 bg-sky-500/15 text-sky-200'
                              : 'border-zinc-700 bg-zinc-950/60 text-zinc-300'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-zinc-400" htmlFor="book-name">
                    Name
                  </label>
                  <input
                    id="book-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={130}
                    autoComplete="name"
                    enterKeyHint="next"
                    className="w-full min-h-[48px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base text-white placeholder:text-zinc-600"
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-zinc-400" htmlFor="book-phone">
                    Phone
                  </label>
                  <input
                    id="book-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    maxLength={45}
                    autoComplete="tel"
                    inputMode="tel"
                    enterKeyHint="next"
                    className="w-full min-h-[48px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base text-white placeholder:text-zinc-600"
                    placeholder="Mobile number"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-zinc-400" htmlFor="book-email">
                    Email <span className="font-normal text-zinc-500">(optional)</span>
                  </label>
                  <input
                    id="book-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    maxLength={170}
                    autoComplete="email"
                    enterKeyHint="done"
                    className="w-full min-h-[48px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base text-white placeholder:text-zinc-600"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-zinc-400" htmlFor="book-notes">
                    Note <span className="font-normal text-zinc-500">(optional)</span>
                  </label>
                  <textarea
                    id="book-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={1250}
                    rows={2}
                    className="min-h-[4rem] w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base text-white placeholder:text-zinc-600 leading-snug"
                  />
                </div>

                <div
                  className="pointer-events-none absolute left-[-9999px] top-0 h-px w-px overflow-hidden opacity-0"
                  aria-hidden="true"
                >
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

              <div className="flex shrink-0 gap-3 border-t border-zinc-800 bg-zinc-900 px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 min-h-[52px] rounded-xl border border-zinc-600 py-3.5 text-base font-semibold text-zinc-200 touch-manipulation"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[1.2] inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3.5 text-base font-semibold text-white touch-manipulation disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
