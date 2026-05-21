import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  vehicleCounts,
  fetchRecentSold,
  fetchRecentlyAddedStock,
} from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { VehicleCard } from '../components/VehicleCard'
import { LazyVehicleImage } from '../components/LazyVehicleImage'
import {
  Package,
  Lock,
  CheckCircle,
  ShoppingBag,
  ChevronRight,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { LoadingState } from '../components/LoadingState'

export function Search() {
  const { hasPermission } = useAuth()
  const showInventoryShortcut = hasPermission('inventory:view')

  const [stats, setStats] = useState({
    available: 0,
    newly_arrived: 0,
    reserved: 0,
    sold: 0,
  })
  const [recentSales, setRecentSales] = useState([])
  const [newestStock, setNewestStock] = useState([])
  const [dashboardLoading, setDashboardLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setDashboardLoading(true)
    Promise.all([fetchRecentSold(8), fetchRecentlyAddedStock(8)])
      .then(([sold, fresh]) => {
        if (!cancelled) {
          setRecentSales(sold || [])
          setNewestStock(fresh || [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecentSales([])
          setNewestStock([])
        }
      })
      .finally(() => {
        if (!cancelled) setDashboardLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    vehicleCounts().then(setStats)
  }, [])

  return (
    <div className="flex flex-col pb-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500/90 mb-1.5">
              Dashboard
            </p>
            <h1 className="text-2xl md:text-[1.65rem] font-bold text-white tracking-tight flex items-center gap-2.5">
              <LayoutDashboard className="w-7 h-7 text-amber-400 shrink-0" aria-hidden />
              Overview
            </h1>
            <p className="text-zinc-500 text-sm mt-2 max-w-xl leading-relaxed">
              Live snapshots of stock and sold units. Search any vehicle or contact from the bar above — open{' '}
              {showInventoryShortcut ? (
                <Link to="/app/inventory" className="text-amber-400/95 hover:text-amber-300">
                  Inventory
                </Link>
              ) : (
                <Link to="/find" className="text-amber-400/95 hover:text-amber-300">
                  public stock
                </Link>
              )}{' '}
              when you want filters and paging.
            </p>
          </div>
          {showInventoryShortcut ? (
            <Link
              to="/app/inventory"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-sm font-medium text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 transition shrink-0"
            >
              Full inventory
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </Link>
          ) : (
            <Link
              to="/find"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition shrink-0"
            >
              Browse public stock
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-zinc-950/40 p-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400/85 uppercase tracking-wider">
                Available
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">{stats.available}</p>
          </div>
          <div className="rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/35 to-zinc-950/40 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="text-[10px] font-semibold text-cyan-400/85 uppercase tracking-wider">
                New arrivals
              </span>
            </div>
            <p className="text-2xl font-bold text-cyan-400 mt-1 tabular-nums">{stats.newly_arrived}</p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/35 to-zinc-950/40 p-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-400/85 uppercase tracking-wider">Reserved</span>
            </div>
            <p className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">{stats.reserved}</p>
          </div>
          <div className="rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-950/35 to-zinc-950/40 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-rose-400" />
              <span className="text-[10px] font-semibold text-rose-400/85 uppercase tracking-wider">Sold (total)</span>
            </div>
            <p className="text-2xl font-bold text-rose-400 mt-1 tabular-nums">{stats.sold}</p>
          </div>
        </div>

        {dashboardLoading ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-6 min-h-[200px] flex items-center justify-center">
              <LoadingState message="Loading dashboard…" variant="embedded" />
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-6 min-h-[200px] flex items-center justify-center">
              <LoadingState message="" variant="embedded" />
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/45 overflow-hidden flex flex-col min-h-[280px]">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-zinc-800/70 bg-zinc-950/50">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-rose-400" />
                  Recent sales
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">By update time</span>
              </div>
              {!recentSales.length ? (
                <p className="text-zinc-500 text-sm px-4 py-10 text-center">No recorded sales yet.</p>
              ) : (
                <ul className="p-3 space-y-2 flex-1 overflow-y-auto max-h-[min(420px,50vh)]">
                  {recentSales.map((v) => {
                    const buyer = v.buyers_name || v.customer_name || '—'
                    const thumb = v.images?.[0]?.url
                    const whenTs = v._updatedAt ?? v.updated_at ?? v.created_at ?? v._createdAt
                    const when = whenTs
                      ? new Date(whenTs).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'
                    return (
                      <li key={v.id}>
                        <Link
                          to={`/vehicle/${v.id}`}
                          className="flex gap-3 p-2.5 rounded-xl bg-zinc-950/55 border border-zinc-800/70 hover:border-rose-500/30 hover:bg-zinc-900/65 transition group"
                        >
                          <div className="relative w-[4.25rem] h-[3.35rem] rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                            <LazyVehicleImage
                              src={thumb}
                              alt=""
                              className="absolute inset-0 w-full h-full"
                              imgClassName="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="min-w-0 flex-1 flex justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-white text-[13px] leading-snug truncate">
                                {v.brand} {v.model}
                              </p>
                              {v.stock_id != null && (
                                <p className="text-[11px] text-zinc-500 font-mono">#{v.stock_id}</p>
                              )}
                              <p className="text-[12px] text-zinc-400 mt-1 truncate">
                                <span className="text-zinc-500">To </span>
                                <span className="text-zinc-300">{buyer}</span>
                                {v.selling_price != null && (
                                  <span className="text-rose-400/95 font-medium ml-1.5">
                                    £{Number(v.selling_price).toLocaleString()}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <span className="text-[11px] text-zinc-500 tabular-nums">{when}</span>
                              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                            </div>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/45 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-zinc-800/70 bg-zinc-950/50">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  Latest stock additions
                </h2>
                {showInventoryShortcut ? (
                  <Link to="/app/inventory" className="text-[11px] font-medium text-amber-400 hover:text-amber-300 shrink-0">
                    View all
                  </Link>
                ) : null}
              </div>
              {!newestStock.length ? (
                <p className="text-zinc-500 text-sm px-4 py-10 text-center">No active stock yet.</p>
              ) : (
                <div className="p-4 grid grid-cols-2 gap-3">
                  {newestStock.slice(0, 8).map((v) => (
                    <VehicleCard key={v.id} vehicle={v} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
