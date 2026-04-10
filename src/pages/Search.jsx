import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  fetchBrandsAndModels,
  vehicleCounts,
  fetchRecentSold,
  fetchVehiclesForList,
  fetchVehiclesByPlateOrStock,
} from '../lib/sanityData'
import { useNotification } from '../context/NotificationContext'
import { VehicleCard } from '../components/VehicleCard'
import { CameraCapture } from '../components/CameraCapture'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, Camera, QrCode, X, Package, Lock, CheckCircle, PoundSterling, ShoppingBag, ChevronRight } from 'lucide-react'

const findPageUrl = () => `${window.location.origin}/find`

export function Search() {
  const [query, setQuery] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')
  const [models, setModels] = useState([])
  const [modelsByBrandMap, setModelsByBrandMap] = useState({})
  const [brands, setBrands] = useState([])
  const [stats, setStats] = useState({ available: 0, reserved: 0, sold: 0 })
  const [modelCounts, setModelCounts] = useState({})
  const [cameraOpen, setCameraOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [recentSales, setRecentSales] = useState([])
  const navigate = useNavigate()
  const { addNotification } = useNotification()

  const maxPriceFilter = maxPriceInput.trim() ? parseFloat(maxPriceInput) : null
  const isValidMaxPrice = maxPriceFilter != null && !isNaN(maxPriceFilter) && maxPriceFilter > 0
  const shouldSearch = query.trim() || brandFilter || modelFilter || isValidMaxPrice

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
    fetchRecentSold(8).then((rows) =>
      setRecentSales(
        (rows || []).map((v) => ({
          id: v.id,
          stock_id: v.stock_id,
          brand: v.brand,
          model: v.model,
          buyers_name: v.buyers_name,
          customer_name: v.customer_name,
          selling_price: v.selling_price,
          created_at: v.created_at,
          updated_at: v.updated_at,
        }))
      )
    )
  }, [])

  useEffect(() => {
    vehicleCounts().then(setStats)
  }, [])

  useEffect(() => {
    if (!shouldSearch) {
      setVehicles([])
      return
    }
    const timer = setTimeout(() => searchVehicles(), 300)
    return () => clearTimeout(timer)
  }, [query, brandFilter, modelFilter, isValidMaxPrice, maxPriceFilter])

  async function searchVehicles() {
    setLoading(true)
    try {
      const withUrls = await fetchVehiclesForList({
        search: query.trim() || undefined,
        brand: brandFilter || undefined,
        model: modelFilter || undefined,
        maxPrice: isValidMaxPrice ? maxPriceFilter : undefined,
        limit: 100,
      })
      const counts = {}
      withUrls.forEach((v) => {
        const key = `${(v.brand || '').trim()}|${(v.model || '').trim()}`
        counts[key] = (counts[key] || 0) + 1
      })
      setModelCounts(counts)
      setVehicles(withUrls)
    } catch {
      setVehicles([])
    } finally {
      setLoading(false)
    }
  }

  async function searchByPlateOrStockId(text) {
    if (!text) return
    const q = text.trim()
    setQuery(q)
    setLoading(true)
    try {
      const withUrls = await fetchVehiclesByPlateOrStock(q)
      const counts = {}
      withUrls.forEach((v) => {
        const key = `${(v.brand || '')}|${(v.model || '')}`
        counts[key] = (counts[key] || 0) + 1
      })
      setModelCounts(counts)
      setVehicles(withUrls)
      if (withUrls.length === 1) {
        addNotification('Vehicle found!', 'success')
        navigate(`/vehicle/${withUrls[0].id}`)
      } else if (withUrls.length === 0) {
        addNotification(`No vehicle found for: ${q}`, 'info')
      }
    } catch {
      setVehicles([])
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
      setQuery(result.plate)
      setVehicles(result.vehicles)
      const counts = {}
      result.vehicles.forEach((v) => {
        const key = `${(v.brand || '')}|${(v.model || '')}`
        counts[key] = (counts[key] || 0) + 1
      })
      setModelCounts(counts)
      if (result.vehicles.length === 1) {
        addNotification('Vehicle found!', 'success')
        navigate(`/vehicle/${result.vehicles[0].id}`)
      } else {
        addNotification(`${result.vehicles.length} vehicles found`, 'success')
      }
    } else if (result.plate) {
      searchByPlateOrStockId(result.plate)
    } else if (result.candidates?.length) {
      addNotification(`No match for: ${result.candidates.join(', ')}`, 'info')
    } else {
      addNotification('Could not detect plate or stock ID. Try again with a clearer image.', 'info')
    }
  }

  const clearFilters = () => {
    setQuery('')
    setBrandFilter('')
    setModelFilter('')
    setMaxPriceInput('')
  }

  const getModelCount = (v) => {
    const key = `${(v.brand || '').trim()}|${(v.model || '').trim()}`
    return modelCounts[key] || 1
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col">
      {/* Stats bar - at a glance */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider">Available</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.available}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-medium text-amber-400/80 uppercase tracking-wider">Reserved</span>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stats.reserved}</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-rose-400" />
            <span className="text-xs font-medium text-rose-400/80 uppercase tracking-wider">Sold</span>
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-1">{stats.sold}</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="-mx-4 md:-mx-0 mb-6 px-4 md:px-0 pb-6 rounded-b-2xl md:rounded-xl bg-zinc-900/40 border-b md:border border-zinc-800/50">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white tracking-tight">Quick find</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Search, filter by price, brand & model</p>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Stock ID, plate, brand, model..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="shrink-0 w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-zinc-400 hover:text-white flex items-center justify-center"
            aria-label="QR code"
          >
            <QrCode className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="shrink-0 w-12 h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center"
            aria-label="Scan plate"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>

        {/* Max price input */}
        <div className="mb-4">
          <label className="block text-xs text-zinc-500 mb-1.5 flex items-center gap-1.5">
            <PoundSterling className="w-3.5 h-3.5" />
            Max price (£)
          </label>
          <input
            type="number"
            min="0"
            step="100"
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
            placeholder="e.g. 10000"
            className="w-full max-w-[10rem] px-4 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40"
          />
        </div>

        {/* Brand & model - only show what exists */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Brand</label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-white focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Model</label>
            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-white focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="">All models</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {(query || brandFilter || modelFilter || maxPriceInput.trim()) && (
          <button type="button" onClick={clearFilters} className="mt-3 text-sm text-amber-400 hover:text-amber-300">
            Clear all
          </button>
        )}
      </div>

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setQrOpen(false)}>
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Scan to access</h3>
              <button type="button" onClick={() => setQrOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG value={findPageUrl()} size={200} level="M" />
              </div>
              <p className="text-zinc-500 text-sm text-center break-all">{findPageUrl()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && !shouldSearch && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-900/30">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/60 flex items-center justify-center">
              <SearchIcon className="w-8 h-8 text-zinc-500" />
            </div>
            <p className="text-zinc-400">Search or use filters</p>
            <p className="text-zinc-500 text-sm mt-1">Try &quot;Under £10k&quot; or pick a brand</p>
          </div>
        )}

        {!loading && shouldSearch && vehicles.length === 0 && (
          <div className="text-center py-16 rounded-2xl border border-zinc-800/50 bg-zinc-900/30">
            <p className="text-zinc-400">No vehicles match</p>
            <button type="button" onClick={clearFilters} className="mt-2 text-amber-400 hover:text-amber-300 text-sm">
              Clear filters
            </button>
          </div>
        )}

        {!loading && vehicles.length > 0 && (
          <>
            <p className="text-zinc-500 text-sm mb-4">
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} modelCount={getModelCount(v)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recent sales - latest 8 */}
      <div className="mt-10 pt-8 border-t border-zinc-800/60">
        <h2 className="text-sm font-semibold text-zinc-400 flex items-center gap-2 mb-4">
          <ShoppingBag className="w-4 h-4 text-rose-400" />
          Recent sales
        </h2>
        {recentSales.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4">No sales yet</p>
        ) : (
          <div className="space-y-2">
            {recentSales.map((v) => {
              const buyer = v.buyers_name || v.customer_name || '—'
              const date = (v.updated_at || v.created_at) ? new Date(v.updated_at || v.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
              return (
                <Link
                  key={v.id}
                  to={`/vehicle/${v.id}`}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/60 hover:bg-zinc-800/60 hover:border-zinc-600/60 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">
                      {v.brand} {v.model}
                      {v.stock_id && <span className="text-zinc-500 font-normal ml-1">#{v.stock_id}</span>}
                    </p>
                    <p className="text-sm text-zinc-400 truncate">
                      Sold to <span className="text-zinc-300">{buyer}</span>
                      {v.selling_price != null && (
                        <span className="text-amber-400 ml-2">£{Number(v.selling_price).toLocaleString()}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <p className="text-xs text-zinc-500">{date}</p>
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {cameraOpen && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} searchFn={searchFn} />
      )}
    </div>
  )
}
