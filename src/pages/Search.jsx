import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useNotification } from '../context/NotificationContext'
import { VehicleCard } from '../components/VehicleCard'
import { CameraCapture } from '../components/CameraCapture'
import { Search as SearchIcon, Camera, QrCode, X } from 'lucide-react'

const findPageUrl = () => `${window.location.origin}/find`

const BRANDS = ['Audi', 'BMW', 'Fiat', 'Honda', 'Kia', 'Lexus', 'Mazda', 'Mercedes-Benz', 'Nissan', 'Toyota']

export function Search() {
  const [query, setQuery] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [models, setModels] = useState([])
  const [cameraOpen, setCameraOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const navigate = useNavigate()
  const { addNotification } = useNotification()

  const shouldSearch = query.trim() || brandFilter || modelFilter

  // Fetch models when brand changes
  useEffect(() => {
    if (!brandFilter) {
      setModels([])
      setModelFilter('')
      return
    }
    supabase
      .from('vehicles')
      .select('model')
      .ilike('brand', brandFilter)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map((r) => r.model).filter(Boolean))].sort()
        setModels(unique)
        setModelFilter('')
      })
  }, [brandFilter])

  useEffect(() => {
    if (!shouldSearch) {
      setVehicles([])
      return
    }
    const timer = setTimeout(() => searchVehicles(), 300)
    return () => clearTimeout(timer)
  }, [query, brandFilter, modelFilter])

  async function searchVehicles() {
    setLoading(true)
    try {
      let qb = supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_images (
            id,
            storage_path,
            sort_order
          )
        `)

      if (query.trim()) {
        qb = qb.or(
          `stock_id.ilike.%${query.trim()}%,plate_no.ilike.%${query.trim()}%,brand.ilike.%${query.trim()}%,model.ilike.%${query.trim()}%,location.ilike.%${query.trim()}%`
        )
      }
      if (brandFilter) qb = qb.ilike('brand', brandFilter)
      if (modelFilter) qb = qb.ilike('model', modelFilter)

      const { data, error } = await qb.limit(50)

      if (error) throw error

      const withUrls = (data || []).map((v) => {
        const images = (v.vehicle_images || []).map((img) => ({
          ...img,
          url: supabase.storage.from('vehicle-images').getPublicUrl(img.storage_path).data.publicUrl,
        }))
        return { ...v, images }
      })

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
      // Search ONLY plate_no OR stock_id - fast, targeted
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_images (id, storage_path, sort_order)
        `)
        .or(`plate_no.ilike.%${q}%,stock_id.ilike.%${q}%`)
        .limit(5)

      if (error) throw error

      const withUrls = (data || []).map((v) => {
        const images = (v.vehicle_images || []).map((img) => ({
          ...img,
          url: supabase.storage.from('vehicle-images').getPublicUrl(img.storage_path).data.publicUrl,
        }))
        return { ...v, images }
      })

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
    const { data, error } = await supabase
      .from('vehicles')
      .select(`*, vehicle_images (id, storage_path, sort_order)`)
      .or(`plate_no.ilike.%${q}%,stock_id.ilike.%${q}%`)
      .limit(5)
    if (error) return { vehicles: [] }
    const withUrls = (data || []).map((v) => {
      const images = (v.vehicle_images || []).map((img) => ({
        ...img,
        url: supabase.storage.from('vehicle-images').getPublicUrl(img.storage_path).data.publicUrl,
      }))
      return { ...v, images }
    })
    return { vehicles: withUrls }
  }

  const handleCameraCapture = (result) => {
    setCameraOpen(false)
    if (result.vehicles?.length > 0) {
      setQuery(result.plate)
      setVehicles(result.vehicles)
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
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col">
      {/* Search bar + Camera */}
      <div className="-mx-4 -mt-4 mb-6 px-4 pt-4 pb-6 rounded-b-3xl bg-gradient-to-b from-orange-500/20 via-orange-500/10 to-transparent border-b border-slate-700/50">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Stock ID, plate, brand, model..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="shrink-0 w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center"
              aria-label="Show QR code"
            >
              <QrCode className="w-7 h-7" />
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="shrink-0 w-14 h-14 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center"
              aria-label="Scan plate"
            >
              <Camera className="w-7 h-7" />
            </button>
          </div>

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

          {/* Dropdown filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Brand</label>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
              >
                <option value="">All brands</option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Model</label>
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
              >
                <option value="">All models</option>
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          {(query || brandFilter || modelFilter) && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-orange-400 hover:text-orange-300"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && !shouldSearch && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-orange-500/20 flex items-center justify-center">
              <Camera className="w-10 h-10 text-orange-500" />
            </div>
            <p className="text-slate-400 text-lg">Search or scan a plate</p>
            <p className="text-slate-500 text-sm mt-1">Use the camera to capture a plate number</p>
          </div>
        )}

        {!loading && shouldSearch && vehicles.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">No vehicles found</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-orange-400 hover:text-orange-300 text-sm"
            >
              Try different search
            </button>
          </div>
        )}

        {!loading && vehicles.length > 0 && (
          <>
            <p className="text-slate-400 text-sm mb-4">
              {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          </>
        )}
      </div>

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
