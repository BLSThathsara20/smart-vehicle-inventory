import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { VehicleForm } from '../components/VehicleForm'
import { ArrowLeft, MapPin, Tag, Gauge, Calendar, Fuel, Settings2, Pencil } from 'lucide-react'

export function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addNotification } = useNotification()
  const isAdmin = !!user
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    fetchVehicle()
  }, [id])

  async function fetchVehicle() {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_images (
            id,
            storage_path,
            sort_order
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      const images = (data?.vehicle_images || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => ({
          ...img,
          url: supabase.storage.from('vehicle-images').getPublicUrl(img.storage_path).data.publicUrl,
        }))

      setVehicle({ ...data, images })
    } catch (err) {
      addNotification(err.message || 'Vehicle not found', 'error')
      navigate(isAdmin ? '/app' : '/find')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!vehicle) return null

  async function handleDelete() {
    if (!confirm('Delete this vehicle?')) return
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id)
      if (error) throw error
      addNotification('Vehicle deleted', 'success')
      navigate('/app/inventory')
    } catch (err) {
      addNotification(err.message || 'Delete failed', 'error')
    }
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        <div>
        <button
          onClick={() => setEditing(false)}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl font-bold text-white mb-4">Edit Vehicle</h1>
        <VehicleForm vehicle={vehicle} onSuccess={() => { setEditing(false); fetchVehicle(); }} />
      </div>
        </main>
      </div>
    )
  }

  const primaryImage = vehicle.images?.[0]?.url
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23334155" width="400" height="300"/%3E%3Ctext fill="%2364748b" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="24"%3ECar%3C/text%3E%3C/svg%3E'

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
    <div className={!isAdmin ? 'pb-8' : ''}>
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-700 mb-4">
        <img
          src={primaryImage || placeholder}
          alt={`${vehicle.brand} ${vehicle.model}`}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex gap-2 mb-4">
        {vehicle.sold && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-600 text-white">Sold</span>
        )}
        {vehicle.reserved && !vehicle.sold && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-600 text-white">Reserved</span>
        )}
        <span className="px-3 py-1 rounded-full text-sm font-mono bg-orange-500/20 text-orange-400">
          #{vehicle.stock_id}
        </span>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">
        {vehicle.brand} {vehicle.model}
      </h1>
      {vehicle.body && (
        <p className="text-slate-400 mb-4">{vehicle.body}</p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        {vehicle.location && (
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin className="w-4 h-4 text-orange-500" />
            <span>{vehicle.location}</span>
          </div>
        )}
        {vehicle.plate_no && (
          <div className="flex items-center gap-2 text-slate-300">
            <Tag className="w-4 h-4 text-orange-500" />
            <span>{vehicle.plate_no}</span>
          </div>
        )}
        {vehicle.mileage != null && (
          <div className="flex items-center gap-2 text-slate-300">
            <Gauge className="w-4 h-4 text-orange-500" />
            <span>{vehicle.mileage?.toLocaleString()} miles</span>
          </div>
        )}
        {vehicle.model_year && (
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-orange-500" />
            <span>{vehicle.model_year}</span>
          </div>
        )}
        {vehicle.fuel_type && (
          <div className="flex items-center gap-2 text-slate-300">
            <Fuel className="w-4 h-4 text-orange-500" />
            <span>{vehicle.fuel_type}</span>
          </div>
        )}
        {vehicle.gear && (
          <div className="flex items-center gap-2 text-slate-300">
            <Settings2 className="w-4 h-4 text-orange-500" />
            <span>{vehicle.gear}</span>
          </div>
        )}
        {vehicle.color && <span className="text-slate-300">Color: {vehicle.color}</span>}
        {vehicle.cc && <span className="text-slate-300">{vehicle.cc} cc</span>}
      </div>

      {vehicle.details && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-slate-400 mb-1">Details</h3>
          <p className="text-slate-300">{vehicle.details}</p>
        </div>
      )}

      {vehicle.features && Object.keys(vehicle.features).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Features</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(vehicle.features).map(([k, v]) => (
              <span
                key={k}
                className={`px-3 py-1 rounded-full text-sm ${
                  v ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-500'
                }`}
              >
                {k}: {String(v)}
              </span>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <button
          onClick={handleDelete}
          className="w-full py-3 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-semibold"
        >
          Delete Vehicle
        </button>
      )}
    </div>
      </main>
    </div>
  )
}
