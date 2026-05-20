import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchVehicleByPickupToken, fetchWorkflowUpdates } from '../lib/sanityData'
import {
  verificationMatches,
  pickupVerifiedStorageKey,
} from '../lib/pickupVerification'
import {
  CUSTOMER_VISIBLE_STEPS,
  isReservationStepComplete,
} from '../lib/reservationWorkflow'
import {
  Lock,
  ClipboardCheck,
  FileCheck,
  Calendar,
  Package,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Sparkles,
  Car,
  Wrench,
} from 'lucide-react'
import { Footer } from '../components/Footer'
import { LazyVehicleImage } from '../components/LazyVehicleImage'
import { LoadingState } from '../components/LoadingState'

const ICONS = {
  Lock,
  ClipboardCheck,
  FileCheck,
  Calendar,
  Package,
  CheckCircle,
  Wrench,
}

export function CustomerPickup() {
  const { token } = useParams()
  const [vehicle, setVehicle] = useState(null)
  const [workflow, setWorkflow] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [plateVerified, setPlateVerified] = useState(false)
  const [plateInput, setPlateInput] = useState('')
  const [plateError, setPlateError] = useState('')
  const [pickupLoadMessage, setPickupLoadMessage] = useState('Looking up your vehicle…')
  useEffect(() => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }
    fetchVehicleAndStatus()
  }, [token])

  async function fetchVehicleAndStatus() {
    setLoading(true)
    setNotFound(false)
    setPickupLoadMessage('Looking up your vehicle…')
    try {
      const vehicleData = await fetchVehicleByPickupToken(token)
      if (!vehicleData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setVehicle(vehicleData)
      setPickupLoadMessage('Loading reservation progress…')

      const needsVerify =
        (vehicleData.plate_no && String(vehicleData.plate_no).trim() !== '') ||
        (vehicleData.stock_id != null && String(vehicleData.stock_id).trim() !== '')

      if (!needsVerify) {
        setPlateVerified(true)
      } else {
        const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(pickupVerifiedStorageKey(token)) : null
        if (cached && verificationMatches(cached, vehicleData)) {
          setPlateVerified(true)
        }
      }

      const wData = await fetchWorkflowUpdates(vehicleData.id)
      const byStep = {}
      ;(wData || []).forEach((u) => {
        if (!byStep[u.step_key]) byStep[u.step_key] = u
      })
      setWorkflow(byStep)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const getStepDone = (step) =>
    isReservationStepComplete(step.key, workflow, vehicle, { customer: true })

  const isReadyToPickup = !!workflow.ready_to_pickup

  function handlePlateSubmit(e) {
    e.preventDefault()
    setPlateError('')
    const raw = String(plateInput || '').trim()
    if (!raw) {
      setPlateError('Enter your plate number or stock ID')
      return
    }
    if (!verificationMatches(raw, vehicle)) {
      setPlateError("That doesn't match our records. Check your plate or stock ID and try again.")
      return
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(pickupVerifiedStorageKey(token), raw)
    }
    setPlateVerified(true)
    setPlateInput('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white px-4">
        <LoadingState message={pickupLoadMessage} variant="fullscreen" />
      </div>
    )
  }

  if (notFound || !vehicle) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white px-4">
        <AlertCircle className="w-14 h-14 text-amber-500/60 mb-4" />
        <h1 className="text-xl font-semibold text-zinc-300">Reservation not found</h1>
        <p className="text-zinc-500 text-sm mt-2 text-center">
          This link may be invalid or the reservation has been completed.
        </p>
        <Footer />
      </div>
    )
  }

  const primaryImage = vehicle.images?.[0]?.url
  const customerName = vehicle.customer_name || vehicle.buyers_name
  const hasCustomerDetails = customerName || vehicle.customer_email || vehicle.customer_phone

  const showPlateGate =
    vehicle &&
    !plateVerified &&
    ((vehicle.plate_no && String(vehicle.plate_no).trim() !== '') ||
      (vehicle.stock_id != null && String(vehicle.stock_id).trim() !== ''))

  const pickupImportantNotice =
    typeof vehicle.pickup_important_notice === 'string'
      ? vehicle.pickup_important_notice.trim()
      : ''

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative">
      {/* Plate verification gate - blur overlay until correct plate entered */}
      {showPlateGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-amber-500/30 bg-zinc-900/95 p-6 shadow-xl shadow-amber-500/5">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 mb-4 mx-auto">
              <Car className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white text-center mb-1">Verify your vehicle</h2>
            <p className="text-sm text-zinc-400 text-center mb-4">
              Enter the number plate <span className="text-zinc-500">or</span> stock ID for your reserved vehicle to view
              progress and details
            </p>
            <form onSubmit={handlePlateSubmit} className="space-y-3">
              <input
                type="text"
                value={plateInput}
                onChange={(e) => { setPlateInput(e.target.value); setPlateError('') }}
                placeholder="e.g. AB12 CDE or stock ID"
                autoComplete="off"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-center text-lg font-medium tracking-wider placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              />
              {plateError && <p className="text-sm text-red-400 text-center">{plateError}</p>}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition"
              >
                Continue
              </button>
            </form>
            <p className="text-[10px] text-zinc-500 text-center mt-4">
              Your verification is saved in this browser for future visits
            </p>
          </div>
        </div>
      )}
      {/* Subtle gradient background for premium feel */}
      <div className="fixed inset-0 bg-gradient-to-b from-amber-950/20 via-transparent to-zinc-950 pointer-events-none" aria-hidden />
      <main className={`relative max-w-lg mx-auto px-4 pt-6 pb-24 ${showPlateGate ? 'blur-sm pointer-events-none select-none' : ''}`}>
        {/* Personal greeting */}
        <div className="mb-6">
          {customerName ? (
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Hi, {customerName.split(' ')[0]}!
            </h1>
          ) : null}
          <p className="text-lg text-amber-400/90 mt-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Your {vehicle.brand} {vehicle.model} is reserved for you
          </p>
        </div>

        {/* Planned collection - shown at top for better UX */}
        {vehicle.planned_collection_date && (
          <div className="mb-6 px-5 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/5">
            <p className="text-amber-400/90 text-xs uppercase tracking-wider font-semibold mb-1">Planned collection</p>
            <p className="text-amber-400 font-bold text-lg">
              {new Date(vehicle.planned_collection_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        )}

        {pickupImportantNotice ? (
          <div
            className="mb-6 rounded-2xl border border-red-500/45 bg-gradient-to-br from-red-950/50 to-red-950/25 px-4 py-4 shadow-lg shadow-red-900/20 ring-1 ring-red-400/15"
            role="alert"
          >
            <div className="flex gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-300">Important notice</p>
                <p className="text-[15px] text-red-50/95 mt-2 whitespace-pre-wrap leading-relaxed">{pickupImportantNotice}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Status banner - Ready to pickup when manager approved */}
        {isReadyToPickup && (
          <div className="mb-6 px-5 py-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-lg">Ready to collect!</p>
                <p className="text-sm text-emerald-400/90 mt-0.5">
                  Your vehicle has been approved and is waiting for you. Come pick it up anytime.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Car hero image */}
        <div className="rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-xl shadow-amber-500/5 mb-6">
          <div className="aspect-[4/3] relative">
            <LazyVehicleImage
              src={primaryImage}
              alt={`Your ${vehicle.brand} ${vehicle.model}`}
              className="absolute inset-0 w-full h-full"
              imgClassName="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-sm font-bold shadow-lg">
                <Lock className="w-4 h-4" />
                Reserved for you
              </span>
              <p className="text-white font-semibold text-lg mt-2 drop-shadow-lg">
                {vehicle.brand} {vehicle.model}
              </p>
              {vehicle.stock_id && (
                <p className="text-amber-200/90 text-sm">Stock #{vehicle.stock_id}</p>
              )}
            </div>
          </div>
        </div>

        {/* Your reservation details - customer info */}
        {hasCustomerDetails && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-950/30 p-4 shadow-inner">
            <h3 className="text-sm font-semibold text-amber-400/90 flex items-center gap-2 mb-3">
              <User className="w-4 h-4" />
              Your reservation details
            </h3>
            <div className="space-y-2.5">
              {customerName && (
                <div className="flex items-center gap-3 text-zinc-200">
                  <User className="w-4 h-4 text-amber-500/70 shrink-0" />
                  <span className="font-medium">{customerName}</span>
                </div>
              )}
              {vehicle.customer_email && (
                <div className="flex items-center gap-3 text-zinc-300">
                  <Mail className="w-4 h-4 text-amber-500/70 shrink-0" />
                  <a href={`mailto:${vehicle.customer_email}`} className="hover:text-amber-400 transition">
                    {vehicle.customer_email}
                  </a>
                </div>
              )}
              {vehicle.customer_phone && (
                <div className="flex items-center gap-3 text-zinc-300">
                  <Phone className="w-4 h-4 text-amber-500/70 shrink-0" />
                  <a href={`tel:${vehicle.customer_phone}`} className="hover:text-amber-400 transition">
                    {vehicle.customer_phone}
                  </a>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-3">This vehicle is reserved under your name</p>
          </div>
        )}

        {/* Order progress */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden backdrop-blur">
          <h3 className="text-sm font-semibold text-zinc-400 px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500/80" />
            Your order progress
          </h3>
          <div className="divide-y divide-zinc-800/40">
            {CUSTOMER_VISIBLE_STEPS.map((step) => {
              const Icon = ICONS[step.icon] || Lock
              const done = getStepDone(step)

              return (
                <div key={step.key} className="px-4 py-3.5 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${
                      done ? 'bg-emerald-500/25 text-emerald-400 ring-2 ring-emerald-500/30' : 'bg-zinc-800/60 text-zinc-500'
                    }`}
                  >
                    {done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${done ? 'text-zinc-200' : 'text-zinc-500'}`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Your vehicle specs */}
        <div className="mt-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
          <h3 className="text-sm font-semibold text-zinc-400 mb-4">Your vehicle</h3>
          <div className="grid grid-cols-2 gap-4">
            {vehicle.color && (
              <div className="p-3 rounded-xl bg-zinc-800/40">
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Color</p>
                <p className="text-white font-medium mt-0.5">{vehicle.color}</p>
              </div>
            )}
            {vehicle.mileage != null && (
              <div className="p-3 rounded-xl bg-zinc-800/40">
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Mileage</p>
                <p className="text-white font-medium mt-0.5">{Number(vehicle.mileage).toLocaleString()} miles</p>
              </div>
            )}
            {vehicle.model_year && (
              <div className="p-3 rounded-xl bg-zinc-800/40">
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Year</p>
                <p className="text-white font-medium mt-0.5">{vehicle.model_year}</p>
              </div>
            )}
          </div>
        </div>

        <Footer />
      </main>
    </div>
  )
}
