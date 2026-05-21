import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  fetchBrandsAndModels,
  fetchVehiclesPage,
  fetchVehiclesByPlateOrStock,
} from '../lib/sanityData'
import { VehicleCard } from '../components/VehicleCard'
import { CameraCapture } from '../components/CameraCapture'
import { useNotification } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'
import {
  Search as SearchIcon,
  Camera,
  LogIn,
  QrCode,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Car,
  CalendarClock,
} from 'lucide-react'
import { Footer } from '../components/Footer'
import { LoadingState } from '../components/LoadingState'

const findPageUrl = () => `${window.location.origin}/find`
const PAGE_SIZE = 12

function getPageNumbers(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  if (current <= 3) {
    pages.push(1, 2, 3, 4, '...', total)
  } else if (current >= total - 2) {
    pages.push(1, '...', total - 3, total - 2, total - 1, total)
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total)
  }
  return [...new Set(pages)]
}

export function PublicFind() {
  const { user, profile, hasPermission, loading: authLoading } = useAuth()
  const canStaffInventory = Boolean(user && !authLoading && hasPermission('inventory:view'))
  const limitedStaffBanner = Boolean(
    user && !authLoading && profile && !hasPermission('inventory:view'),
  )
  const accountPendingBanner = Boolean(user && !authLoading && !profile)
  const signedInPublic = Boolean(user && !authLoading)

  const [stockId, setStockId] = useState('')
  const [vin, setVin] = useState('')
  const [plate, setPlate] = useState('')
  const [keyword, setKeyword] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [models, setModels] = useState([])
  const [modelsByBrandMap, setModelsByBrandMap] = useState({})
  const [brands, setBrands] = useState([])

  const [vehicles, setVehicles] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchLoadMessage, setSearchLoadMessage] = useState('Loading stock…')
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)

  const [cameraOpen, setCameraOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const { addNotification } = useNotification()

  const filters = useMemo(() => {
    const f = {
      publicCatalog: true,
      search: keyword.trim() || undefined,
      stock_id: stockId.trim() || undefined,
      vin: vin.trim() || undefined,
      plate_no: plate.trim() || undefined,
      brand: brandFilter || undefined,
      model: modelFilter || undefined,
    }
    Object.keys(f).forEach((k) => {
      if (f[k] === undefined) delete f[k]
    })
    return f
  }, [keyword, stockId, vin, plate, brandFilter, modelFilter])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1)

  useEffect(() => {
    fetchBrandsAndModels().then(({ brands: b, modelsByBrand }) => {
      setBrands(b || [])
      setModelsByBrandMap(modelsByBrand || {})
    })
  }, [])

  useEffect(() => {
    if (!brandFilter) {
      setModels([])
      setModelFilter('')
      return
    }
    setModels(modelsByBrandMap[brandFilter] || [])
    setModelFilter('')
  }, [brandFilter, modelsByBrandMap])

  useEffect(() => {
    setPage(1)
  }, [filters])

  const loadVehicles = useCallback(async () => {
    setLoading(true)
    setSearchLoadMessage('Loading stock…')
    try {
      const from = (page - 1) * PAGE_SIZE
      const { items, total } = await fetchVehiclesPage(filters, from, PAGE_SIZE)
      setVehicles(items || [])
      setTotalCount(total ?? 0)
    } catch {
      setVehicles([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  async function searchByPlateOrStockId(text) {
    if (!text) return
    const q = text.trim()
    setKeyword(q)
    setStockId('')
    setVin('')
    setPlate('')
    setBrandFilter('')
    setModelFilter('')
    setPage(1)
    setLoading(true)
    setSearchLoadMessage('Looking up plate, stock or VIN…')
    try {
      const list = await fetchVehiclesByPlateOrStock(q)
      setVehicles(list)
      setTotalCount(list.length)
      if (list.length === 1) addNotification('Vehicle found', 'success')
      if (list.length === 0) addNotification(`No match for: ${q}`, 'info')
    } catch {
      setVehicles([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  const searchFn = async (q) => {
    const vehicles = await fetchVehiclesByPlateOrStock(q)
    return { vehicles }
  }

  const handleCameraCapture = (result) => {
    setCameraOpen(false)
    if (result.vehicles?.length > 0) {
      setKeyword(result.plate || '')
      setVehicles(result.vehicles)
      setTotalCount(result.vehicles.length)
      addNotification(
        result.vehicles.length === 1 ? 'Vehicle found!' : `${result.vehicles.length} matches`,
        'success',
      )
    } else if (result.plate) {
      searchByPlateOrStockId(result.plate)
    } else if (result.candidates?.length) {
      addNotification(`No match for: ${result.candidates.join(', ')}`, 'info')
    } else {
      addNotification('Could not detect plate or stock ID. Try again.', 'info')
    }
  }

  const clearFilters = () => {
    setStockId('')
    setVin('')
    setPlate('')
    setKeyword('')
    setBrandFilter('')
    setModelFilter('')
    setPage(1)
  }

  const hasActiveFilters =
    stockId.trim() || vin.trim() || plate.trim() || keyword.trim() || brandFilter || modelFilter

  const advancedFiltersActive =
    Boolean(stockId.trim() || vin.trim() || plate.trim() || brandFilter || modelFilter)

  const clearAdvancedFilters = () => {
    setStockId('')
    setVin('')
    setPlate('')
    setBrandFilter('')
    setModelFilter('')
    setPage(1)
  }

  const cardLink = (id) =>
    canStaffInventory ? `/vehicle/${id}` : `/find/vehicle/${id}`

  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Vehicle stock</h1>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                {signedInPublic
                  ? 'Signed in · Staff account opens your portal or approval status'
                  : 'Browse live inventory · Staff sign-in for full record'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/pullouts"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-sm font-medium"
            >
              <CalendarClock className="w-4 h-4" aria-hidden />
              Pullouts
            </Link>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
              aria-label="Show QR code"
            >
              <QrCode className="w-5 h-5" />
            </button>
            {signedInPublic ? (
              <Link
                to="/app"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-600 text-sm font-semibold"
              >
                {canStaffInventory ? 'Open staff app' : 'Staff account'}
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

      {accountPendingBanner && (
        <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-3 text-center text-sm text-amber-100">
          Finishing your account… If this persists, contact your administrator so we can attach
          permissions to your profile.
        </div>
      )}
      {limitedStaffBanner && !accountPendingBanner && (
        <div className="bg-sky-500/10 border-b border-sky-500/25 px-4 py-3 text-center text-sm text-sky-100">
          You&apos;re signed in, but this account doesn&apos;t include inventory tools yet. You can still browse public
          stock below. Ask an admin to assign a role if you need the full app.
        </div>
      )}

      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Scan to open</h3>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG value={findPageUrl()} size={200} level="M" />
              </div>
              <p className="text-zinc-500 text-xs text-center break-all">{findPageUrl()}</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 pt-8 pb-16">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 md:p-8 mb-8">
          <p className="text-xs font-semibold text-amber-500/90 uppercase tracking-widest mb-1">
            Find your next vehicle
          </p>
          <p className="text-zinc-400 text-sm max-w-2xl mb-6">
            Search keywords for make, model, or location below. Scan a plate anytime. Extra filters refine by stock ID,
            VIN, plate, make, or model — open filtering options when needed.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500/80" />
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Keyword (make, model, location…)"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-zinc-950/80 border border-zinc-700 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold"
              aria-label="Scan plate"
            >
              <Camera className="w-5 h-5" />
              Scan
            </button>
          </div>

          <div className="rounded-xl border border-zinc-700/70 bg-zinc-950/50 overflow-hidden mb-4">
            <button
              type="button"
              id="advanced-filters-toggle"
              aria-expanded={advancedFiltersOpen}
              aria-controls="advanced-filters-panel"
              onClick={() => setAdvancedFiltersOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition"
            >
              <span className="text-sm font-medium text-zinc-200">
                Filtering options{' '}
                <span className="text-zinc-500 font-normal">(stock, VIN, plate, make, model)</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {advancedFiltersActive ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/95 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35">
                    Active
                  </span>
                ) : null}
                <ChevronDown
                  className={`w-5 h-5 text-zinc-400 transition-transform duration-200 ${
                    advancedFiltersOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </span>
            </button>

            <div
              id="advanced-filters-panel"
              role="region"
              aria-labelledby="advanced-filters-toggle"
              hidden={!advancedFiltersOpen}
              className={advancedFiltersOpen ? 'border-t border-zinc-800/70' : undefined}
            >
              {advancedFiltersOpen ? (
                <div className="px-4 pb-4 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Stock ID</label>
                      <input
                        value={stockId}
                        onChange={(e) => setStockId(e.target.value)}
                        placeholder="e.g. AGL…"
                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-600 focus:ring-2 focus:ring-amber-500/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">VIN</label>
                      <input
                        value={vin}
                        onChange={(e) => setVin(e.target.value)}
                        placeholder="Chassis number"
                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-600 focus:ring-2 focus:ring-amber-500/40 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Number plate</label>
                      <input
                        value={plate}
                        onChange={(e) => setPlate(e.target.value.toUpperCase())}
                        placeholder="Registration"
                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-600 focus:ring-2 focus:ring-amber-500/40 uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Make</label>
                      <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:ring-2 focus:ring-amber-500/40"
                      >
                        <option value="">All makes</option>
                        {brands.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1.5">Model</label>
                      <select
                        value={modelFilter}
                        onChange={(e) => setModelFilter(e.target.value)}
                        disabled={!brandFilter}
                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
                      >
                        <option value="">All models</option>
                        {models.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {advancedFiltersActive && (
                    <button
                      type="button"
                      onClick={clearAdvancedFilters}
                      className="text-sm text-amber-400/90 hover:text-amber-300"
                    >
                      Clear filtering options
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm text-zinc-500 hover:text-zinc-400 underline-offset-2 hover:underline"
            >
              Clear all search &amp; filtering options
            </button>
          )}
        </div>

        {loading ? (
          <LoadingState
            message={searchLoadMessage}
            variant="embedded"
            className="py-20"
            spinnerClassName="text-amber-500"
            messageClassName="text-zinc-500"
          />
        ) : vehicles.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30">
            <Car className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
            <p className="text-zinc-400 font-medium">No vehicles match your filters</p>
            <p className="text-zinc-600 text-sm mt-1">Try clearing filters or scan a plate.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-amber-400 hover:text-amber-300 text-sm"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-between items-baseline gap-2 mb-6">
              <p className="text-zinc-500 text-sm">
                <span className="text-zinc-300 font-medium">{totalCount}</span> vehicle
                {totalCount !== 1 ? 's' : ''} in stock
                {!canStaffInventory && (
                  <span className="text-zinc-600"> · tap a card for a public summary</span>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  linkToDetail
                  detailTo={cardLink(v.id)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 py-6 border-t border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!hasPrev}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    {getPageNumbers(page, totalPages).map((p, i) =>
                      p === '...' ? (
                        <span key={`e-${i}`} className="px-2 text-zinc-600">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-medium transition ${
                            page === p
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                              : 'bg-zinc-800/60 border border-zinc-700 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={!hasNext}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-zinc-500 text-sm">
                  Page {page} of {totalPages}
                </span>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      {cameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
          searchFn={searchFn}
        />
      )}
    </div>
  )
}
