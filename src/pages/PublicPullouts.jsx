import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchVehiclesPublicPullouts } from '../lib/sanityData'
import {
  buildPublicPulloutsSchedulePdf,
  summarizePulloutPrepPublic,
} from '../lib/publicPulloutsPdf'
import { useAuth } from '../context/AuthContext'
import { Footer } from '../components/Footer'
import { LoadingState } from '../components/LoadingState'
import {
  CalendarClock,
  Car,
  FileDown,
  LogIn,
  Sparkles,
} from 'lucide-react'

function fmtCollectionDate(raw) {
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(raw)
  }
}

export function PublicPullouts() {
  const { user, hasPermission, loading: authLoading } = useAuth()
  const canStaffInventory = Boolean(user && !authLoading && hasPermission('inventory:view'))
  const signedInPublic = Boolean(user && !authLoading)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchVehiclesPublicPullouts()
      setRows(list || [])
    } catch (e) {
      setError(e?.message || 'Could not load pullout schedule.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const vehicleLink = (id) =>
    canStaffInventory ? `/vehicle/${id}` : `/find/vehicle/${id}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarClock className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Scheduled collections</h1>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Pullout queue · read-only · no customer details on this page
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              to="/find"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-sm font-medium"
            >
              <Car className="w-4 h-4" aria-hidden />
              Stock
            </Link>
            <button
              type="button"
              disabled={loading || rows.length === 0}
              onClick={() => buildPublicPulloutsSchedulePdf(rows)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:pointer-events-none text-white text-sm font-semibold border border-emerald-500"
            >
              <FileDown className="w-4 h-4" aria-hidden />
              Export PDF
            </button>
            {signedInPublic ? (
              <Link
                to="/app"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-600 text-sm font-semibold"
              >
                {canStaffInventory ? 'Staff app' : 'Staff account'}
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-semibold"
              >
                <LogIn className="w-4 h-4" />
                Staff login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400 leading-relaxed">
          <span className="inline-flex items-center gap-2 text-zinc-200 font-medium">
            <Sparkles className="w-4 h-4 text-amber-400" aria-hidden />
            Public viewer
          </span>
          <p className="mt-2">
            Vehicles listed here are reserved with a planned collection date. Preparation work paths show
            progress only (titles and statuses). Pricing, customer contacts, and other private reservation
            fields are not shown.
          </p>
        </div>

        {loading && (
          <LoadingState message="Loading scheduled pullouts…" className="py-16" variant="embedded" />
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-red-100 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="text-zinc-500 text-center py-12">
            No vehicles are currently scheduled with a planned collection date.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400 uppercase text-[11px] tracking-wide">
                    <th className="py-3 px-3 font-semibold">Stock</th>
                    <th className="py-3 px-3 font-semibold">Vehicle</th>
                    <th className="py-3 px-3 font-semibold">Plate</th>
                    <th className="py-3 px-3 font-semibold">Collection</th>
                    <th className="py-3 px-3 font-semibold">Ready</th>
                    <th className="py-3 px-3 font-semibold">Prep work</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-zinc-800/80 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">
                        <Link
                          to={vehicleLink(v.id)}
                          className="text-amber-400 hover:text-amber-300 font-medium"
                        >
                          {v.stock_id != null ? `#${v.stock_id}` : '—'}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-zinc-200">
                        {[v.brand, v.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="py-3 px-3 text-zinc-400">{v.plate_no || '—'}</td>
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">
                        {fmtCollectionDate(v.planned_collection_date)}
                      </td>
                      <td className="py-3 px-3 text-zinc-400">
                        {v.ready_pullout === true ? 'Yes' : 'No'}
                      </td>
                      <td className="py-3 px-3 text-zinc-400 text-[13px] leading-snug max-w-[320px]">
                        {summarizePulloutPrepPublic(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
