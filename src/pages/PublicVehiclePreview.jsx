import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { fetchVehiclePublicById } from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { LazyVehicleImage } from '../components/LazyVehicleImage'
import { LoadingState } from '../components/LoadingState'
import { Footer } from '../components/Footer'
import { ArrowLeft, Car, Lock, LogIn, Package, CheckCircle } from 'lucide-react'

export function PublicVehiclePreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, hasPermission, loading: authLoading } = useAuth()
  const staffAccess = Boolean(user && hasPermission('inventory:view'))

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

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/find" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Stock</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            <LogIn className="w-4 h-4" />
            Staff sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
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
              {vehicle.stock_id != null && vehicle.stock_id !== '' && (
                <p className="text-amber-400/95 font-mono text-sm mt-1">#{vehicle.stock_id}</p>
              )}
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
            {vehicle.mileage != null && (
              <>
                <dt className="text-zinc-500">Mileage</dt>
                <dd>{Number(vehicle.mileage).toLocaleString()} miles</dd>
              </>
            )}
            {vehicle.cc != null && (
              <>
                <dt className="text-zinc-500">Engine</dt>
                <dd>{vehicle.cc} cc</dd>
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
            {vehicle.plate_no && String(vehicle.plate_no).trim() !== '' && (
              <>
                <dt className="text-zinc-500">Plate</dt>
                <dd className="font-mono">{vehicle.plate_no}</dd>
              </>
            )}
            {vehicle.vin && String(vehicle.vin).trim() !== '' && (
              <>
                <dt className="text-zinc-500">VIN</dt>
                <dd className="font-mono text-xs break-all">{vehicle.vin}</dd>
              </>
            )}
          </dl>
          {vehicle.details && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-zinc-500 text-xs uppercase mb-1">Notes</p>
              <p className="text-zinc-400 whitespace-pre-wrap">{vehicle.details}</p>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-zinc-400">
          <p className="text-zinc-300 font-medium mb-1">Staff access</p>
          <p className="text-zinc-500">
            Pricing, reservations, and internal workflow are only visible after you sign in with a dealership account.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm"
          >
            <LogIn className="w-4 h-4" />
            Sign in for full details
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
