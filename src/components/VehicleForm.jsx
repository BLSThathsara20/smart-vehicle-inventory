import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { compressImages } from '../lib/imageCompress'
import { useNotification } from '../context/NotificationContext'
import { ImagePlus, X, Plus } from 'lucide-react'

const BRANDS = ['Audi', 'BMW', 'Fiat', 'Honda', 'Kia', 'Lexus', 'Mazda', 'Mercedes-Benz', 'Nissan', 'Toyota']

const BODY_TYPES = ['Saloon', 'Hatchback', 'Estate', 'SUV', 'MPV', 'Coupe', 'Convertible', 'Pickup', 'Van', 'Other']

const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG']
const GEAR_TYPES = ['Manual', 'Automatic', 'CVT', 'DCT', 'AMT', 'Single Speed']

function featuresToObject(arr) {
  return arr.reduce((acc, f) => {
    const key = String(f).trim()
    if (key) acc[key] = true
    return acc
  }, {})
}

function featuresToArray(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.keys(obj).filter(Boolean)
}

export function VehicleForm({ vehicle, onSuccess }) {
  const { addNotification } = useNotification()
  const [loading, setLoading] = useState(false)
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [imagesToRemove, setImagesToRemove] = useState([])
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')

  const [form, setForm] = useState({
    stock_id: vehicle?.stock_id ?? '',
    plate_no: vehicle?.plate_no ?? '',
    location: vehicle?.location ?? '',
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    body: vehicle?.body ?? '',
    details: vehicle?.details ?? '',
    color: vehicle?.color ?? '',
    mileage: vehicle?.mileage ?? '',
    cc: vehicle?.cc ?? '',
    model_year: vehicle?.model_year ?? '',
    fuel_type: vehicle?.fuel_type ?? '',
    gear: vehicle?.gear ?? '',
    featuresList: featuresToArray(vehicle?.features ?? {}).length
    ? featuresToArray(vehicle?.features ?? {})
    : [''],
    sold: vehicle?.sold ?? false,
    reserved: vehicle?.reserved ?? false,
  })

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  // Fetch location suggestions when typing or on focus (empty = recent locations)
  const fetchLocations = useCallback(async (query) => {
    let q = supabase.from('vehicles').select('location').not('location', 'is', null)
    if (query && query.trim().length >= 2) {
      q = q.ilike('location', `%${query.trim()}%`)
    }
    const { data } = await q.limit(15)
    const unique = [...new Set((data || []).map((r) => r.location).filter(Boolean))]
    setLocationSuggestions(unique)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchLocations(locationQuery), 200)
    return () => clearTimeout(t)
  }, [locationQuery, fetchLocations])

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files || [])
    const currentTotal = existingImages.length - imagesToRemove.length + imageFiles.length
    if (files.length + currentTotal > 4) {
      addNotification('Maximum 4 images allowed', 'error')
      return
    }
    const compressed = await compressImages(files)
    const maxNew = 4 - currentTotal
    const toAdd = compressed.slice(0, maxNew)
    setImageFiles((prev) => [...prev, ...toAdd].slice(0, 4))
    setImagePreviews((prev) => {
      const newPreviews = toAdd.map((f) => URL.createObjectURL(f))
      return [...prev, ...newPreviews].slice(0, 4)
    })
  }

  const removeImage = (idx) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx))
    URL.revokeObjectURL(imagePreviews[idx])
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const removeExistingImage = (img) => {
    setImagesToRemove((prev) => [...prev, img.id])
  }

  const addFeatureField = () => {
    if (form.featuresList.length >= 15) {
      addNotification('Maximum 15 features allowed', 'info')
      return
    }
    update('featuresList', [...form.featuresList, ''])
  }

  const updateFeature = (idx, value) => {
    update('featuresList', form.featuresList.map((v, i) => (i === idx ? value : v)))
  }

  const removeFeature = (idx) => {
    if (form.featuresList.length <= 1) {
      update('featuresList', [''])
      return
    }
    update('featuresList', form.featuresList.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const features = featuresToObject(form.featuresList.filter((f) => String(f).trim()))

      const payload = {
        stock_id: form.stock_id.trim(),
        plate_no: form.plate_no.trim(),
        location: form.location.trim() || null,
        brand: form.brand.trim(),
        model: form.model.trim(),
        body: form.body.trim() || null,
        details: form.details.trim() || null,
        color: form.color.trim() || null,
        mileage: form.mileage ? parseInt(form.mileage, 10) : null,
        cc: form.cc ? parseInt(form.cc, 10) : null,
        model_year: form.model_year ? parseInt(form.model_year, 10) : null,
        fuel_type: form.fuel_type || null,
        gear: form.gear || null,
        features,
        sold: form.sold,
        reserved: form.reserved,
      }

      let vehicleId = vehicle?.id

      if (vehicleId) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', vehicleId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('vehicles').insert(payload).select('id').single()
        if (error) throw error
        vehicleId = data.id
      }

      if (imagesToRemove.length > 0 && vehicleId) {
        const toRemove = (vehicle?.images || []).filter((img) => imagesToRemove.includes(img.id))
        for (const img of toRemove) {
          await supabase.storage.from('vehicle-images').remove([img.storage_path])
        }
        await supabase.from('vehicle_images').delete().in('id', imagesToRemove)
      }

      if (imageFiles.length > 0) {
        const existingCount = (vehicle?.images || []).length - imagesToRemove.length
        const paths = await Promise.all(
          imageFiles.map(async (file, i) => {
            const path = `${vehicleId}/${Date.now()}-${i}.jpg`
            const { error } = await supabase.storage.from('vehicle-images').upload(path, file, {
              upsert: true,
            })
            if (error) throw error
            return { vehicle_id: vehicleId, storage_path: path, sort_order: existingCount + i }
          })
        )
        await supabase.from('vehicle_images').insert(paths)
      }

      addNotification(vehicle ? 'Vehicle updated' : 'Vehicle added', 'success')
      onSuccess?.()
    } catch (err) {
      addNotification(err.message || 'Failed to save', 'error')
    } finally {
      setLoading(false)
    }
  }

  const existingImages = vehicle?.images || []
  const displayedExisting = existingImages.filter((img) => !imagesToRemove.includes(img.id))
  const totalImageCount = displayedExisting.length + imageFiles.length

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Stock ID *</label>
          <input
            type="text"
            value={form.stock_id}
            onChange={(e) => update('stock_id', e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Plate No *</label>
          <input
            type="text"
            value={form.plate_no}
            onChange={(e) => update('plate_no', e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => {
            update('location', e.target.value)
            setLocationQuery(e.target.value)
            setLocationDropdownOpen(true)
          }}
          onFocus={() => setLocationDropdownOpen(true)}
          onBlur={() => setTimeout(() => setLocationDropdownOpen(false), 150)}
          placeholder="Type to search previous locations..."
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
        />
        {locationDropdownOpen && locationSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-10 max-h-40 overflow-y-auto">
            {locationSuggestions.map((loc) => (
              <button
                key={loc}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  update('location', loc)
                  setLocationQuery('')
                  setLocationDropdownOpen(false)
                }}
                className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-700"
              >
                {loc}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Brand *</label>
          <select
            value={form.brand}
            onChange={(e) => update('brand', e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Select brand</option>
            {BRANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Model *</label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => update('model', e.target.value)}
            required
            placeholder="e.g. A3, 3 Series"
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Body</label>
          <select
            value={form.body}
            onChange={(e) => update('body', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Select body type</option>
            {BODY_TYPES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Color</label>
          <input
            type="text"
            value={form.color}
            onChange={(e) => update('color', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Details</label>
        <textarea
          value={form.details}
          onChange={(e) => update('details', e.target.value)}
          rows={3}
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Mileage (miles)</label>
          <input
            type="number"
            value={form.mileage}
            onChange={(e) => update('mileage', e.target.value)}
            placeholder="UK"
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">CC</label>
          <input
            type="number"
            value={form.cc}
            onChange={(e) => update('cc', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Model Year</label>
          <input
            type="number"
            value={form.model_year}
            onChange={(e) => update('model_year', e.target.value)}
            min="1900"
            max="2030"
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Fuel Type</label>
          <select
            value={form.fuel_type}
            onChange={(e) => update('fuel_type', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Select</option>
            {FUEL_TYPES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Gear</label>
        <select
          value={form.gear}
          onChange={(e) => update('gear', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
        >
          <option value="">Select</option>
          {GEAR_TYPES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Features {form.featuresList.length > 0 && `(${form.featuresList.length}/15)`}
        </label>
        <div className="space-y-2">
          {form.featuresList.map((val, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={val}
                onChange={(e) => updateFeature(i, e.target.value)}
                placeholder={`Feature ${i + 1} (e.g. AC, Leather, Sunroof)`}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex gap-1 shrink-0">
                {form.featuresList.length < 15 && i === form.featuresList.length - 1 ? (
                  <button
                    type="button"
                    onClick={addFeatureField}
                    className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white"
                    aria-label="Add feature"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeFeature(i)}
                  className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white"
                  aria-label="Remove feature"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.sold}
            onChange={(e) => update('sold', e.target.checked)}
            className="rounded border-slate-600 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-slate-300">Sold</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.reserved}
            onChange={(e) => update('reserved', e.target.checked)}
            className="rounded border-slate-600 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-slate-300">Reserved</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Images (1-4, compressed)</label>
        <div className="flex flex-wrap gap-2">
          {displayedExisting.map((img) => (
            <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-700">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeExistingImage(img)}
                className="absolute top-1 right-1 p-1 rounded-full bg-red-600 hover:bg-red-500 text-white"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {imagePreviews.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-700">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 p-1 rounded-full bg-red-600 hover:bg-red-500 text-white"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {totalImageCount < 4 && (
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer hover:border-orange-500 transition">
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
              <ImagePlus className="w-8 h-8 text-slate-500" />
            </label>
          )}
        </div>
        {imagesToRemove.length > 0 && (
          <p className="text-slate-500 text-xs mt-1">
            {imagesToRemove.length} image{imagesToRemove.length !== 1 ? 's' : ''} will be removed on save.{' '}
            <button
              type="button"
              onClick={() => setImagesToRemove([])}
              className="text-orange-400 hover:text-orange-300"
            >
              Undo
            </button>
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition disabled:opacity-50"
      >
        {loading ? 'Saving...' : vehicle ? 'Update Vehicle' : 'Add Vehicle'}
      </button>
    </form>
  )
}
