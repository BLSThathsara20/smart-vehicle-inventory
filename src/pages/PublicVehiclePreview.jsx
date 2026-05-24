import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { fetchVehiclePublicById } from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { PublicVehicleFeaturesChips } from '../components/PublicVehicleFeaturesChips'
import { LazyVehicleImage } from '../components/LazyVehicleImage'
import { formatPublicSellingPriceGbp } from '../lib/publicVehicleDisplay'
import { LoadingState } from '../components/LoadingState'
import { Footer } from '../components/Footer'
import { ArrowLeft, Car, Lock, LogIn, Package, CheckCircle, CalendarPlus } from 'lucide-react'

export function PublicVehiclePreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission, loading: authLoading } = useAuth()
  const staffAccess = Boolean(user && hasPermission('inventory:view'))
  const signedInPublic = Boolean(user && !authLoading)

  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (staffAccess && id) {
      navigate(`/vehicle/${id}`, { replace: true })
    }
  }, [authLoading, staffAccess, id, navigate])

  useEffect(() => {
    if (authLoading || staffAccess) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      try {
        const v = await fetchVehiclePublicById(id)
        if (cancelled) return
        if (!v) {
          setNotFound(true)
          setVehicle(null)
        } else {
          setVehicle(v)
        }
      } catch {
        if (!cancelled) {
          setNotFound(true)
          setVehicle(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) load()
    return () => {
      cancelled = true
    }
  }, [id, authLoading, staffAccess])

  if (authLoading || staffAccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LoadingState
          message={staffAccess ? 'Opening in app…' : 'Loading…'}
          variant="embedded"
          className="py-20"
        />
      </div>
    )
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
          <Link to="/find" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to stock
          </Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <Car className="w-14 h-14 text-zinc-600 mb-4" />
          <p className="text-lg font-medium text-zinc-300">Vehicle not found</p>
          <p className="text-zinc-500 text-sm mt-1">It may have been removed or the link is incorrect.</p>
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
  const isSold = vehicle.sold
  const isReserved = vehicle.reserved && !vehicle.sold
  const listedPriceLabel = formatPublicSellingPriceGbp(vehicle.selling_price)

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/find" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Stock</span>
          </Link>
          {signedInPublic ? (
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-600 text-sm text-zinc-100 hover:bg-zinc-700"
            >
              Staff account
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-700"
            >
              <LogIn className="w-4 h-4" />
              Staff sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-6 pb-10">
        {!vehicle.sold && !(vehicle.reserved && !vehicle.sold) && (
          <div className="mb-6 rounded-2xl border border-sky-500/35 bg-gradient-to-br from-sky-500/10 to-zinc-900/50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Want to see this car?</p>
              <p className="text-xs text-zinc-400 mt-1">Pick a day and a rough time — we&apos;ll confirm with you.</p>
            </div>
            <Link
              to={`/book/vehicle/${encodeURIComponent(id)}`}
              className="mt-3 sm:mt-0 shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition"
            >
              <CalendarPlus className="w-4 h-4" />
              Book a viewing
            </Link>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 mb-6">
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

        {isSold && (
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            This vehicle is marked as sold. Contact the dealership for similar stock.
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3 text-sm">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Public summary</p>
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
            {vehicle.vin && String(vehicle.vin).trim() !== '' && (
              <>
                <dt className="text-zinc-500">VIN</dt>
                <dd className="font-mono text-xs break-all">{vehicle.vin}</dd>
              </>
            )}
          </dl>
          <PublicVehicleFeaturesChips features={vehicle.features} />
          {vehicle.details && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-zinc-500 text-xs uppercase mb-1">Notes</p>
              <p className="text-zinc-400 whitespace-pre-wrap">{vehicle.details}</p>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-zinc-400">
          <p className="text-zinc-300 font-medium mb-1">Staff access</p>
          {signedInPublic ? (
            <>
              <p className="text-zinc-500">
                You&apos;re signed in. Summary list price appears here too; reservations, workflows, and full dealership
                data appear once an administrator approves your account and assigns a role.
              </p>
              <Link
                to="/app"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-semibold text-sm"
              >
                Staff portal
              </Link>
            </>
          ) : (
            <>
              <p className="text-zinc-500">
                The listed guide price appears here for shoppers. Reservations, workflows, and full dealer tooling are only
                available after you sign in with a dealership account.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign in for full details
              </Link>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
