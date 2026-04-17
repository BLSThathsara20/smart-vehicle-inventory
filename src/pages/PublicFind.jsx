import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { fetchBrandsAndModels, fetchVehiclesPage, fetchVehiclesByPlateOrStock } from '../lib/sanityData'
import { VehicleCard } from '../components/VehicleCard'
import { CameraCapture } from '../components/CameraCapture'
import { useNotification } from '../context/NotificationContext'
import { Search as SearchIcon, Camera, LogIn, QrCode, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Footer } from '../components/Footer'

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
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  /** When set (including []), show this list instead of paginated inventory (plate / camera). */
  const [directResults, setDirectResults] = useState(null)
  /** True while plate/stock lookup runs so paginated fetch does not race. */
  const [narrowSearchBusy, setNarrowSearchBusy] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [models, setModels] = useState([])
  const [modelsByBrandMap, setModelsByBrandMap] = useState({})
  const [brands, setBrands] = useState([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const { addNotification } = useNotification()

  const filters = useMemo(
    () => ({
      search: debouncedQuery.trim() || undefined,
      brand: brandFilter || undefined,
      model: modelFilter || undefined,
    }),
    [debouncedQuery, brandFilter, modelFilter]
  )
  const filterKey = JSON.stringify(filters)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    fetchBrandsAndModels().then(({ brands: b, modelsByBrand }) => {
      setBrands(b)
      setModelsByBrandMap(modelsByBrand)
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
  }, [filterKey])

  useEffect(() => {
    if (directResults !== null || narrowSearchBusy) return

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const from = (page - 1) * PAGE_SIZE
        const includeTotal = page === 1
        const { items, total } = await fetchVehiclesPage(filters, from, PAGE_SIZE, {
          includeTotal,
          lightProjection: true,
        })
        if (cancelled) return
        setVehicles(items)
        if (typeof total === 'number') setTotalCount(total)
      } catch {
        if (!cancelled) {
          setVehicles([])
          if (page === 1) setTotalCount(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [page, filterKey, directResults, narrowSearchBusy])

  async function searchByPlateOrStockId(text) {
    if (!text) return
    const q = text.trim()
    setQuery(q)
    setDebouncedQuery(q)
    setNarrowSearchBusy(true)
    setLoading(true)
    try {
      const withUrls = await fetchVehiclesByPlateOrStock(q)
      setDirectResults(withUrls)
      if (withUrls.length === 1) {
        addNotification('Vehicle found!', 'success')
      }
      if (withUrls.length === 0) {
        addNotification(`No vehicle found for: ${q}`, 'info')
      }
    } catch {
      setDirectResults([])
    } finally {
      setNarrowSearchBusy(false)
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
      if (result.plate) {
        setQuery(result.plate)
        setDebouncedQuery(result.plate)
      }
      setDirectResults(result.vehicles)
      addNotification(
        result.vehicles.length === 1 ? 'Vehicle found!' : `${result.vehicles.length} vehicles found`,
        'success'
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
    setQuery('')
    setDebouncedQuery('')
    setBrandFilter('')
    setModelFilter('')
    setDirectResults(null)
    setNarrowSearchBusy(false)
  }

  const exitDirectResults = () => {
    setDirectResults(null)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages
  const showPagination = directResults === null && totalPages > 1 && !loading

  const listToRender = directResults !== null ? directResults : vehicles
  const showEmpty = !loading && listToRender.length === 0

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-30 flex justify-between items-center p-4 bg-slate-900/95 backdrop-blur border-b border-slate-700">
        <h1 className="text-lg font-bold">Find Vehicle</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
            aria-label="Show QR code"
          >
            <QrCode className="w-5 h-5" />
          </button>
          <Link
            to="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium"
          >
            <LogIn className="w-4 h-4" />
            Admin Login
          </Link>
        </div>
      </header>

      {qrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Scan to access</h3>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG value={findPageUrl()} size={200} level="M" />
              </div>
              <p className="text-slate-400 text-sm text-center break-all">{findPageUrl()}</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 pt-4 pb-8">
        <div className="space-y-4 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setDirectResults(null)
                  setQuery(e.target.value)
                }}
                placeholder="Stock ID, plate, brand, model..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="shrink-0 w-14 h-14 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center"
              aria-label="Scan plate"
            >
              <Camera className="w-7 h-7" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:max-w-lg">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Brand</label>
              <select
                value={brandFilter}
                onChange={(e) => {
                  setDirectResults(null)
                  setBrandFilter(e.target.value)
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
              >
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Model</label>
              <select
                value={modelFilter}
                onChange={(e) => {
                  setDirectResults(null)
                  setModelFilter(e.target.value)
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
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
          {(query || brandFilter || modelFilter || directResults !== null) && (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={clearFilters} className="text-sm text-orange-400 hover:text-orange-300">
                Clear filters
              </button>
              {directResults !== null && (
                <button type="button" onClick={exitDirectResults} className="text-sm text-slate-400 hover:text-white">
                  Back to full inventory
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-slate-500 text-sm mb-3">
          {directResults !== null
            ? `${directResults.length} match${directResults.length !== 1 ? 'es' : ''} (plate / search)`
            : loading
              ? 'Loading…'
              : `${totalCount} vehicle${totalCount !== 1 ? 's' : ''} in inventory`}
        </p>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && showEmpty && (
          <div className="text-center py-16 rounded-2xl border border-slate-800 bg-slate-800/30">
            <Camera className="w-12 h-12 text-orange-500/60 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No vehicles match</p>
            <p className="text-slate-500 text-sm mt-1">Try another search or clear filters</p>
          </div>
        )}

        {!loading && listToRender.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listToRender.map((v) => (
                <VehicleCard key={v.id} vehicle={v} linkToDetail={false} />
              ))}
            </div>

            {showPagination && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-800">
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!hasPrev}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>
                  <div className="flex items-center gap-1">
                    {getPageNumbers(page, totalPages).map((p, i) =>
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-2 text-slate-500">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`min-w-[2.25rem] h-9 px-2.5 rounded-lg text-sm font-medium ${
                            page === p
                              ? 'bg-orange-500/20 border border-orange-500/50 text-orange-300'
                              : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={!hasNext}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-slate-500 text-sm">
                  Page {page} of {totalPages} · {PAGE_SIZE} per page
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
