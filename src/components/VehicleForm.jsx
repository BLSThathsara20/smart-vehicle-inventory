import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchVehicleLocations, saveVehicle, deleteReservationWorkflowUpdatesForVehicle, fetchBrandsAndModels } from '../lib/sanityData'
import { serializePdiForStorage, seedPdiFromVehicleAndCustomer } from '../lib/pdiInspectionModel'
import { formatSanityMutationError } from '../lib/sanity'
import { uploadImageToImgbb } from '../lib/imgbb'
import { compressImages } from '../lib/imageCompress'
import { useNotification } from '../context/NotificationContext'
import { AccordionSection } from './AccordionSection'
import { ImagePlus, X, Plus, Loader2 } from 'lucide-react'
import { MAX_VEHICLE_IMAGES } from '../lib/vehicleImages'
import {
  parseCommaDecimal,
  parseCommaInt,
  formatTypingIntDigits,
  formatTypingMoney,
  intToDisplayComma,
  decimalToDisplayComma,
} from '../lib/numberFormat'

const BRAND_OTHER = 'Other'

const KNOWN_BRANDS = [
  'Audi',
  'BMW',
  'Fiat',
  'Honda',
  'Kia',
  'Lexus',
  'Mazda',
  'Mercedes-Benz',
  'Nissan',
  'Toyota',
  'Volkswagen',
]

/** Select labels: fixed list + explicit “Other”. */
const BRANDS = [...KNOWN_BRANDS, BRAND_OTHER]
const BODY_TYPES = ['Saloon', 'Hatchback', 'Estate', 'SUV', 'MPV', 'Coupe', 'Convertible', 'Pickup', 'Van', 'Other']
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG']
const GEAR_TYPES = ['Manual', 'Automatic', 'CVT', 'DCT', 'AMT', 'Single Speed']
const DOC_STATUSES = ['Awaiting', 'Received', 'In Progress', 'Complete', 'Missing']
const VEHICLE_STATUSES = ['Available', 'Newly arrived', 'Reserved', 'Sold', 'Withdrawn']
const WARRANTY_OPTIONS = ['Not Done', 'Done 6 Month', 'Done 12 Month', 'Done 24 Month', 'Other']
const WHOLESALE_RETAIL = ['Wholesale', 'Retail']
const YES_NO = ['yes', 'no']
const Y_N = ['y', 'n']

const inputClass = 'w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-zinc-400 mb-1'
const selectClass = 'w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:ring-2 focus:ring-amber-500'

/** Module-level so React does not remount inputs on every parent render (focus loss bug). */
function VehicleField({ label, children }) {
  return (
    <div>
      {label && <label className={labelClass}>{label}</label>}
      {children}
    </div>
  )
}

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

function initialBrandFields(vehicle) {
  const saved = (vehicle?.brand ?? '').trim()
  if (!saved) return { brand: '', brand_other: '' }
  if (KNOWN_BRANDS.includes(saved)) return { brand: saved, brand_other: '' }
  return { brand: BRAND_OTHER, brand_other: saved }
}

const defaultForm = (vehicle) => {
  const bf = initialBrandFields(vehicle)
  const isNewVehicle = !vehicle?.id

  return {
  stock_id: vehicle?.stock_id ?? (isNewVehicle ? 'AGL' : ''),
  plate_no: vehicle?.plate_no ?? '',
  location: vehicle?.location ?? '',
  vin: vehicle?.vin ?? '',
  ...bf,
  model: vehicle?.model ?? '',
  body: vehicle?.body ?? '',
  details: vehicle?.details ?? '',
  color: vehicle?.color ?? '',
  mileage: intToDisplayComma(vehicle?.mileage),
  cc: intToDisplayComma(vehicle?.cc),
  model_year: vehicle?.model_year != null && vehicle?.model_year !== '' ? String(vehicle.model_year) : '',
  fuel_type: vehicle?.fuel_type ?? '',
  gear: vehicle?.gear ?? '',
  featuresList: featuresToArray(vehicle?.features ?? {}).length ? featuresToArray(vehicle?.features ?? {}) : [''],
  photographed: vehicle?.photographed ?? false,
  photo_drive_link: vehicle?.photo_drive_link ?? '',
  service_record: vehicle?.service_record ?? 'yes',
  fb_listed: vehicle?.fb_listed ?? false,
  web_listed: vehicle?.web_listed ?? false,
  web_url: vehicle?.web_url ?? '',
  autotrader_listed: vehicle?.autotrader_listed ?? false,
  autotrader_url: vehicle?.autotrader_url ?? '',
  ads_details: vehicle?.ads_details ?? '',
  doc_status: vehicle?.doc_status ?? '',
  shipment_no: vehicle?.shipment_no ?? '',
  shipment_arrived_date: vehicle?.shipment_arrived_date ?? '',
  key_no: vehicle?.key_no ?? '',
  car_key_location:
    vehicle?.car_key_location != null && vehicle.car_key_location !== ''
      ? String(vehicle.car_key_location)
      : '',
  vehicle_status: vehicle?.vehicle_status ?? (vehicle?.sold ? 'Sold' : vehicle?.reserved ? 'Reserved' : 'Available'),
  reserved_date: vehicle?.reserved_date ?? '',
  deposit_amount:
    vehicle?.deposit_amount != null && vehicle?.deposit_amount !== ''
      ? decimalToDisplayComma(vehicle.deposit_amount)
      : '',
  customer_name: vehicle?.customer_name ?? vehicle?.buyers_name ?? '',
  customer_email: vehicle?.customer_email ?? '',
  customer_phone: vehicle?.customer_phone ?? '',
  deposit_agreement_url: vehicle?.deposit_agreement_url ?? '',
  carplay_included: vehicle?.carplay_included ?? false,
  buyers_name: vehicle?.buyers_name ?? '',
  planned_collection_date: vehicle?.planned_collection_date ?? '',
  pickup_important_notice: vehicle?.pickup_important_notice ?? '',
  pending_issues: vehicle?.pending_issues ?? false,
  pending_issues_details: vehicle?.pending_issues_details ?? '',
  iva_booked: vehicle?.iva_booked ?? '',
  v5c: vehicle?.v5c ?? '',
  v5c_send_date: vehicle?.v5c_send_date ?? '',
  v5c_received_date: vehicle?.v5c_received_date ?? '',
  mot_done: vehicle?.mot_done ?? false,
  mot_expiry_date: vehicle?.mot_expiry_date ?? '',
  service_done: vehicle?.service_done ?? false,
  battery_replaced: vehicle?.battery_replaced ?? false,
  extra_parts: vehicle?.extra_parts ?? '',
  dial_ordered: vehicle?.dial_ordered ?? false,
  body_work_required: vehicle?.body_work_required ?? false,
  media_system: vehicle?.media_system ?? false,
  reverse_camera: vehicle?.reverse_camera ?? false,
  front_camera: vehicle?.front_camera ?? false,
  front_sensor: vehicle?.front_sensor ?? false,
  rear_sensor: vehicle?.rear_sensor ?? false,
  spare_key: vehicle?.spare_key ?? false,
  v55_registration_done: vehicle?.v55_registration_done ?? false,
  selling_price:
    vehicle?.selling_price != null && vehicle?.selling_price !== ''
      ? decimalToDisplayComma(vehicle.selling_price)
      : '',
  warranty: vehicle?.warranty ?? '',
  id_type: vehicle?.id_type ?? '',
  wholesale_retail: vehicle?.wholesale_retail ?? '',
  plate_received: vehicle?.plate_received ?? false,
  ready_pullout: vehicle?.ready_pullout ?? false,
  }
}


export function VehicleForm({ vehicle, onSuccess, initialOpenSale }) {
  const { addNotification } = useNotification()
  const [loading, setLoading] = useState(false)
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [imagesToRemove, setImagesToRemove] = useState([])
  const [imageCompressing, setImageCompressing] = useState(false)
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [modelsByBrandMap, setModelsByBrandMap] = useState({})
  const modelListDomId = useMemo(
    () => `vehicle-model-dl-${(vehicle?.id || 'new').replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [vehicle?.id],
  )
  const [openSections, setOpenSections] = useState({
    core: true,
    technical: true,
    media: false,
    listing: false,
    documentation: false,
    sale: initialOpenSale ?? false,
    condition: false,
  })

  const [form, setForm] = useState(() => defaultForm(vehicle))

  useEffect(() => {
    setForm(defaultForm(vehicle))
  }, [vehicle?.id])

  useEffect(() => {
    fetchBrandsAndModels()
      .then(({ modelsByBrand }) => setModelsByBrandMap(modelsByBrand || {}))
      .catch(() => setModelsByBrandMap({}))
  }, [])

  const modelsForCurrentBrand = useMemo(() => {
    const key =
      form.brand === BRAND_OTHER
        ? (form.brand_other || '').trim()
        : (form.brand || '').trim()
    if (!key) return []
    return modelsByBrandMap[key] || []
  }, [form.brand, form.brand_other, modelsByBrandMap])

  useEffect(() => {
    const hasPlate = Boolean((form.plate_no || '').trim())
    setForm((prev) => {
      if (prev.plate_received === hasPlate) return prev
      return { ...prev, plate_received: hasPlate }
    })
  }, [form.plate_no])

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }))

  const fetchLocations = useCallback(async (query) => {
    const list = await fetchVehicleLocations(query)
    setLocationSuggestions(list)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchLocations(locationQuery), 200)
    return () => clearTimeout(t)
  }, [locationQuery, fetchLocations])

  const handleImageChange = async (e) => {
    const input = e.target
    const files = Array.from(input.files || [])
    input.value = ''
    const existingKept = (vehicle?.images || []).length - imagesToRemove.length
    const room = MAX_VEHICLE_IMAGES - existingKept - imageFiles.length
    if (room <= 0) {
      addNotification(`Maximum ${MAX_VEHICLE_IMAGES} images allowed`, 'error')
      return
    }
    const toProcess = files.slice(0, room)
    if (!toProcess.length) return
    if (files.length > room) {
      addNotification(`Only ${room} more image(s) added (max ${MAX_VEHICLE_IMAGES} total)`, 'info')
    }
    setImageCompressing(true)
    try {
      const compressed = await compressImages(toProcess)
      const toAdd = compressed.slice(0, room)
      const maxNew = MAX_VEHICLE_IMAGES - existingKept
      setImageFiles((prev) => [...prev, ...toAdd].slice(0, maxNew))
      setImagePreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))].slice(0, maxNew))
    } finally {
      setImageCompressing(false)
    }
  }

  const removeImage = (idx) => {
    URL.revokeObjectURL(imagePreviews[idx])
    setImageFiles((prev) => prev.filter((_, i) => i !== idx))
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const removeExistingImage = (img) => setImagesToRemove((prev) => [...prev, img.id])

  const addFeatureField = () => {
    if (form.featuresList.length >= 15) return addNotification('Max 15 features', 'info')
    update('featuresList', [...form.featuresList, ''])
  }

  const updateFeature = (idx, value) =>
    update('featuresList', form.featuresList.map((v, i) => (i === idx ? value : v)))

  const removeFeature = (idx) => {
    if (form.featuresList.length <= 1) return update('featuresList', [''])
    update('featuresList', form.featuresList.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const reserved = form.vehicle_status === 'Reserved'
    if (form.mot_done && !String(form.mot_expiry_date || '').trim()) {
      addNotification('MOT expiry date is required when MOT is marked as done.', 'error')
      return
    }
    const resolvedBrand =
      form.brand === BRAND_OTHER ? (form.brand_other || '').trim() : (form.brand || '').trim()
    let car_key_location_num = null
    const ckRaw = String(form.car_key_location ?? '').trim()
    if (ckRaw !== '') {
      const n = Number(ckRaw)
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        addNotification('Car key location must be a whole number (or leave blank).', 'error')
        return
      }
      car_key_location_num = n
    }

    if (!resolvedBrand) {
      addNotification('Brand is required (choose a maker or specify under Other).', 'error')
      return
    }
    if (form.brand === BRAND_OTHER && !(form.brand_other || '').trim()) {
      addNotification('Please type the manufacturer name under “Other”.', 'error')
      return
    }
    if (reserved) {
      if (String(form.deposit_amount ?? '').trim() === '') {
        addNotification('Deposit amount is required when status is Reserved (use 0 if no deposit)', 'error')
        return
      }
      const dep = parseCommaDecimal(form.deposit_amount)
      if (dep === null) {
        addNotification('Deposit amount must be a valid number.', 'error')
        return
      }
      if (!form.customer_name?.trim()) {
        addNotification('Customer name is required when status is Reserved', 'error')
        return
      }
      if (!form.customer_email?.trim()) {
        addNotification('Customer email is required when status is Reserved', 'error')
        return
      }
      if (!form.customer_phone?.trim()) {
        addNotification('Customer phone is required when status is Reserved', 'error')
        return
      }
    }
    setLoading(true)
    try {
      const features = featuresToObject(form.featuresList.filter((f) => String(f).trim()))
      const sold = form.vehicle_status === 'Sold'
      const newPickupToken = reserved && !vehicle?.pickup_token
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
        : null

      const payload = {
        stock_id: form.stock_id.trim(),
        plate_no: (form.plate_no || '').trim() || null,
        location: form.location.trim() || null,
        vin: form.vin.trim() || null,
        brand: resolvedBrand,
        model: form.model.trim(),
        body: form.body.trim() || null,
        details: form.details.trim() || null,
        color: form.color.trim() || null,
        mileage: parseCommaInt(form.mileage),
        cc: parseCommaInt(form.cc),
        model_year: form.model_year ? parseInt(form.model_year, 10) : null,
        fuel_type: form.fuel_type || null,
        gear: form.gear || null,
        features,
        sold,
        reserved,
        photographed: form.photographed,
        photo_drive_link: form.photographed ? (form.photo_drive_link?.trim() || null) : null,
        service_record: form.service_record || 'yes',
        fb_listed: form.fb_listed,
        web_listed: form.web_listed,
        web_url: form.web_listed ? (form.web_url?.trim() || null) : null,
        autotrader_listed: form.autotrader_listed,
        autotrader_url: form.autotrader_listed ? (form.autotrader_url?.trim() || null) : null,
        ads_details: form.ads_details?.trim() || null,
        doc_status: form.doc_status || null,
        shipment_no: form.shipment_no?.trim() || null,
        shipment_arrived_date: form.shipment_arrived_date || null,
        key_no: form.key_no?.trim() || null,
        car_key_location: car_key_location_num,
        vehicle_status: form.vehicle_status || 'Available',
        reserved_date: reserved ? (form.reserved_date || null) : null,
        deposit_amount: reserved ? parseCommaDecimal(form.deposit_amount) ?? 0 : null,
        customer_name: reserved ? (form.customer_name?.trim() || null) : null,
        customer_email: reserved ? (form.customer_email?.trim() || null) : null,
        customer_phone: reserved ? (form.customer_phone?.trim() || null) : null,
        deposit_agreement_url: reserved ? (form.deposit_agreement_url?.trim() || null) : null,
        carplay_included: reserved ? form.carplay_included : null,
        buyers_name: sold
          ? form.buyers_name?.trim() || null
          : reserved
            ? form.customer_name?.trim() || form.buyers_name?.trim() || null
            : null,
        planned_collection_date: reserved ? (form.planned_collection_date || null) : null,
        pickup_important_notice: reserved ? (form.pickup_important_notice?.trim() || null) : null,
        pending_issues: form.pending_issues,
        pending_issues_details: form.pending_issues ? (form.pending_issues_details?.trim() || null) : null,
        iva_booked: form.iva_booked || null,
        v5c: form.v5c || null,
        v5c_send_date: form.v5c_send_date || null,
        v5c_received_date: form.v5c_received_date || null,
        mot_done: form.mot_done,
        mot_expiry_date: form.mot_done ? (form.mot_expiry_date || null) : null,
        service_done: form.service_done,
        battery_replaced: form.battery_replaced,
        extra_parts: form.extra_parts?.trim() || null,
        dial_ordered: form.dial_ordered,
        body_work_required: form.body_work_required,
        media_system: form.media_system,
        reverse_camera: form.reverse_camera,
        front_camera: form.front_camera,
        front_sensor: form.front_sensor,
        rear_sensor: form.rear_sensor,
        spare_key: form.spare_key,
        v55_registration_done: form.v55_registration_done,
        selling_price: parseCommaDecimal(form.selling_price),
        warranty: form.warranty || null,
        id_type: form.id_type || null,
        wholesale_retail: form.wholesale_retail || null,
        plate_received: form.plate_received,
        ready_pullout: form.ready_pullout,
        pickup_token: reserved ? (vehicle?.pickup_token || newPickupToken) : null,
        ...(reserved && !vehicle?.reserved && !vehicle?.pdi_inspection
          ? {
              pdi_inspection_json: serializePdiForStorage(
                seedPdiFromVehicleAndCustomer(
                  {
                    plate_no: form.plate_no,
                    vin: form.vin,
                    mileage: parseCommaInt(form.mileage),
                    brand: resolvedBrand,
                    model: form.model.trim(),
                    customer_name: form.customer_name,
                  },
                  {}
                )
              ),
            }
          : {}),
        ...(vehicle?.id && vehicle.reserved && !reserved ? { pdi_inspection_json: null } : {}),
      }

      const newImageUrls =
        imageFiles.length > 0
          ? await Promise.all(imageFiles.map((file) => uploadImageToImgbb(file)))
          : []

      const existingDoc = vehicle
        ? {
            images: (vehicle.images || []).map((i) => ({
              _key: i.id,
              id: i.id,
              url: i.url,
              sortOrder: i.sort_order,
            })),
          }
        : null

      await saveVehicle({
        vehicleId: vehicle?.id,
        payload,
        existingDoc,
        newImageUrls,
        removedImageKeys: new Set(imagesToRemove),
      })

      if (vehicle?.id && vehicle.reserved && !reserved) {
        try {
          await deleteReservationWorkflowUpdatesForVehicle(vehicle.id)
        } catch {
          /* best-effort: vehicle is already released */
        }
      }

      addNotification(vehicle ? 'Vehicle updated' : 'Vehicle added', 'success')
      onSuccess?.()
    } catch (err) {
      addNotification(formatSanityMutationError(err) || 'Failed to save', 'error')
    } finally {
      setLoading(false)
    }
  }

  const existingImages = vehicle?.images || []
  const displayedExisting = existingImages.filter((img) => !imagesToRemove.includes(img.id))
  const totalImageCount = displayedExisting.length + imageFiles.length

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 1. Core Identification */}
      <AccordionSection title="1. Core Identification" open={openSections.core} onToggle={() => toggleSection('core')} variant="core">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VehicleField label="Stock ID *">
            <input
              type="text"
              value={form.stock_id}
              onChange={(e) => update('stock_id', e.target.value)}
              placeholder="Starts with AGL…"
              required
              className={inputClass}
            />
            <p className="text-[11px] text-zinc-500 mt-1">New vehicles default to the AGL prefix; adjust the rest as needed.</p>
          </VehicleField>
          <VehicleField label="Plate No">
            <input
              type="text"
              value={form.plate_no}
              onChange={(e) =>
                update('plate_no', e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, '') || '')
              }
              placeholder="Add when allocated (optional)"
              className={`${inputClass} uppercase`}
            />
            <p className="text-[11px] text-zinc-500 mt-1">Leave blank until the registration plate is confirmed; stock still saves.</p>
          </VehicleField>
          <VehicleField label="VIN">
            <input type="text" value={form.vin} onChange={(e) => update('vin', e.target.value)} placeholder="Vehicle Identification Number" className={inputClass} />
          </VehicleField>
          <VehicleField label="Location">
            <div className="relative">
              <input
                type="text"
                value={form.location}
                onChange={(e) => { update('location', e.target.value); setLocationQuery(e.target.value); setLocationDropdownOpen(true) }}
                onFocus={() => setLocationDropdownOpen(true)}
                onBlur={() => setTimeout(() => setLocationDropdownOpen(false), 150)}
                placeholder="Type to search..."
                className={inputClass}
              />
              {locationDropdownOpen && locationSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 py-1 rounded-lg bg-zinc-800 border border-zinc-700 z-10 max-h-40 overflow-y-auto">
                  {locationSuggestions.map((loc) => (
                    <button key={loc} type="button" onMouseDown={(e) => { e.preventDefault(); update('location', loc); setLocationQuery(''); setLocationDropdownOpen(false) }} className="w-full px-4 py-2 text-left text-zinc-300 hover:bg-zinc-700">
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </VehicleField>
          <VehicleField label="Car key location">
            <input
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              placeholder="e.g. cupboard / hook number"
              value={form.car_key_location}
              onChange={(e) => update('car_key_location', e.target.value)}
              className={inputClass}
            />
          </VehicleField>
          <VehicleField label="Brand *">
            <select
              value={form.brand}
              onChange={(e) => {
                const nb = e.target.value
                setForm((prev) => ({
                  ...prev,
                  brand: nb,
                  brand_other: nb === BRAND_OTHER ? prev.brand_other : '',
                }))
              }}
              required
              className={selectClass}
            >
              <option value="">Select brand</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {form.brand === BRAND_OTHER && (
              <input
                type="text"
                value={form.brand_other}
                onChange={(e) => update('brand_other', e.target.value)}
                placeholder="Manufacturer name"
                required
                className={`mt-2 ${inputClass}`}
              />
            )}
          </VehicleField>
          <VehicleField label="Model *">
            <input
              type="text"
              list={modelListDomId}
              autoComplete="off"
              value={form.model}
              onChange={(e) => update('model', e.target.value)}
              placeholder="Pick from suggestions or type a model"
              required
              className={inputClass}
            />
            <datalist id={modelListDomId}>
              {modelsForCurrentBrand.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-[11px] text-zinc-500 mt-1">
              After you choose a make, models you&apos;ve used before for that make appear as suggestions. Type any model name if it&apos;s new.
            </p>
          </VehicleField>
          <VehicleField label="Body Type">
            <select value={form.body} onChange={(e) => update('body', e.target.value)} className={selectClass}>
              <option value="">Select</option>
              {BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </VehicleField>
          <VehicleField label="Color">
            <input type="text" value={form.color} onChange={(e) => update('color', e.target.value)} className={inputClass} />
          </VehicleField>
        </div>
        <VehicleField label="Details">
          <textarea value={form.details} onChange={(e) => update('details', e.target.value)} rows={3} className={inputClass} />
        </VehicleField>
      </AccordionSection>

      {/* 2. Technical Specs */}
      <AccordionSection title="2. Technical Specs" open={openSections.technical} onToggle={() => toggleSection('technical')} variant="technical">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <VehicleField label="Mileage (miles)">
            <input
              type="text"
              inputMode="numeric"
              value={form.mileage}
              onChange={(e) => update('mileage', formatTypingIntDigits(e.target.value))}
              placeholder="e.g. 45,000"
              className={inputClass}
            />
          </VehicleField>
          <VehicleField label="CC">
            <input
              type="text"
              inputMode="numeric"
              value={form.cc}
              onChange={(e) => update('cc', formatTypingIntDigits(e.target.value))}
              placeholder="e.g. 2,000"
              className={inputClass}
            />
          </VehicleField>
          <VehicleField label="Model Year">
            <input type="number" value={form.model_year} onChange={(e) => update('model_year', e.target.value)} min="1900" max="2030" className={inputClass} />
          </VehicleField>
          <VehicleField label="Fuel Type">
            <select value={form.fuel_type} onChange={(e) => update('fuel_type', e.target.value)} className={selectClass}>
              <option value="">Select</option>
              {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </VehicleField>
          <VehicleField label="Gear">
            <select value={form.gear} onChange={(e) => update('gear', e.target.value)} className={selectClass}>
              <option value="">Select</option>
              {GEAR_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </VehicleField>
        </div>
        <VehicleField label="Car Features">
          <div className="space-y-2">
            {form.featuresList.map((val, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={val} onChange={(e) => updateFeature(i, e.target.value)} placeholder={`Feature ${i + 1}`} className={`flex-1 ${inputClass}`} />
                <div className="flex gap-1 shrink-0">
                  {form.featuresList.length < 15 && i === form.featuresList.length - 1 && (
                    <button type="button" onClick={addFeatureField} className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-5 h-5" /></button>
                  )}
                  <button type="button" onClick={() => removeFeature(i)} className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-400"><X className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
          </div>
        </VehicleField>
      </AccordionSection>

      {/* 3. Media & Photography */}
      <AccordionSection title="3. Media & Photography" open={openSections.media} onToggle={() => toggleSection('media')} variant="media">
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.photographed} onChange={(e) => update('photographed', e.target.checked)} className="rounded border-zinc-600 text-amber-500" />
            <span className="text-zinc-300">Photographed</span>
          </label>
        </div>
        {form.photographed && (
          <VehicleField label="Photo Drive Link">
            <input type="url" value={form.photo_drive_link} onChange={(e) => update('photo_drive_link', e.target.value)} placeholder="Google Drive / Dropbox link" className={inputClass} />
          </VehicleField>
        )}
        <VehicleField label={`Images (up to ${MAX_VEHICLE_IMAGES}, compressed before upload)`}>
          <p className="text-[11px] text-zinc-600 mb-2">
            Photos are resized and compressed in the browser to save bandwidth and storage.
          </p>
          <div className="flex flex-wrap gap-2">
            {displayedExisting.map((img) => (
              <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-zinc-700">
                <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                <button type="button" onClick={() => removeExistingImage(img)} className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {imagePreviews.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-zinc-700">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {totalImageCount < MAX_VEHICLE_IMAGES && (
              <label
                className={`w-20 h-20 rounded-lg border-2 border-dashed border-zinc-600 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition ${
                  imageCompressing ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  disabled={imageCompressing}
                  className="hidden"
                />
                {imageCompressing ? (
                  <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
                ) : (
                  <ImagePlus className="w-8 h-8 text-zinc-500" />
                )}
              </label>
            )}
          </div>
          {imagesToRemove.length > 0 && (
            <p className="text-zinc-500 text-xs mt-1">
              {imagesToRemove.length} will be removed.{' '}
              <button type="button" onClick={() => setImagesToRemove([])} className="text-amber-400 hover:text-amber-300">Undo</button>
            </p>
          )}
        </VehicleField>
      </AccordionSection>

      {/* 4. Listing & Advertising */}
      <AccordionSection title="4. Listing & Advertising" open={openSections.listing} onToggle={() => toggleSection('listing')} variant="listing">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VehicleField label="Service Record">
            <select value={form.service_record} onChange={(e) => update('service_record', e.target.value)} className={selectClass}>
              {YES_NO.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </VehicleField>
          <VehicleField label="FB Listed">
            <select value={form.fb_listed ? 'yes' : 'no'} onChange={(e) => update('fb_listed', e.target.value === 'yes')} className={selectClass}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </VehicleField>
          <VehicleField label="Web Listed">
            <select value={form.web_listed ? 'yes' : 'no'} onChange={(e) => update('web_listed', e.target.value === 'yes')} className={selectClass}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </VehicleField>
          {form.web_listed && (
            <VehicleField label="Web URL">
              <input type="url" value={form.web_url} onChange={(e) => update('web_url', e.target.value)} className={inputClass} />
            </VehicleField>
          )}
          <VehicleField label="Autotrader Listed">
            <select value={form.autotrader_listed ? 'yes' : 'no'} onChange={(e) => update('autotrader_listed', e.target.value === 'yes')} className={selectClass}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </VehicleField>
          {form.autotrader_listed && (
            <VehicleField label="Autotrader URL">
              <input type="url" value={form.autotrader_url} onChange={(e) => update('autotrader_url', e.target.value)} className={inputClass} />
            </VehicleField>
          )}
        </div>
        <VehicleField label="ADS Details">
          <textarea value={form.ads_details} onChange={(e) => update('ads_details', e.target.value)} rows={2} className={inputClass} />
        </VehicleField>
      </AccordionSection>

      {/* 5. Documentation */}
      <AccordionSection title="5. Documentation" open={openSections.documentation} onToggle={() => toggleSection('documentation')} variant="documentation">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VehicleField label="Doc. Status">
            <select value={form.doc_status} onChange={(e) => update('doc_status', e.target.value)} className={selectClass}>
              <option value="">Select</option>
              {DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </VehicleField>
          <VehicleField label="Shipment No">
            <input type="text" value={form.shipment_no} onChange={(e) => update('shipment_no', e.target.value)} className={inputClass} />
          </VehicleField>
          <VehicleField label="Shipment Arrived Date">
            <input type="date" value={form.shipment_arrived_date} onChange={(e) => update('shipment_arrived_date', e.target.value)} className={inputClass} />
          </VehicleField>
          <VehicleField label="Key No">
            <input type="text" value={form.key_no} onChange={(e) => update('key_no', e.target.value)} className={inputClass} />
          </VehicleField>
          <VehicleField label="IVA Booked">
            <select value={form.iva_booked} onChange={(e) => update('iva_booked', e.target.value)} className={selectClass}>
              <option value="">Select</option>
              {Y_N.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </VehicleField>
          <VehicleField label="V5C">
            <select value={form.v5c} onChange={(e) => update('v5c', e.target.value)} className={selectClass}>
              <option value="">Select</option>
              {Y_N.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </VehicleField>
          <VehicleField label="V5C Send Date">
            <input type="date" value={form.v5c_send_date} onChange={(e) => update('v5c_send_date', e.target.value)} className={inputClass} />
          </VehicleField>
          <VehicleField label="V5C Received Date">
            <input type="date" value={form.v5c_received_date} onChange={(e) => update('v5c_received_date', e.target.value)} className={inputClass} />
          </VehicleField>
        </div>
        <div className="flex flex-wrap gap-4 items-start">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.mot_done}
              onChange={(e) => {
                const on = e.target.checked
                setForm((prev) => ({
                  ...prev,
                  mot_done: on,
                  mot_expiry_date: on ? prev.mot_expiry_date : '',
                }))
              }}
              className="rounded border-zinc-600 text-amber-500"
            />
            <span className="text-zinc-300">MOT done</span>
          </label>
          {['service_done', 'v55_registration_done'].map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form[key]} onChange={(e) => update(key, e.target.checked)} className="rounded border-zinc-600 text-amber-500" />
              <span className="text-zinc-300 capitalize">{key.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
        {form.mot_done && (
          <VehicleField label="MOT expiry date *">
            <input type="date" value={form.mot_expiry_date} onChange={(e) => update('mot_expiry_date', e.target.value)} className={inputClass} required />
          </VehicleField>
        )}
      </AccordionSection>

      {/* 6. Sale & Reservation */}
      <AccordionSection title="6. Sale & Reservation" open={openSections.sale} onToggle={() => toggleSection('sale')} variant="sale">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VehicleField label="Status">
            <select value={form.vehicle_status} onChange={(e) => update('vehicle_status', e.target.value)} className={selectClass}>
              {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </VehicleField>
          <VehicleField label="Reserved Date">
            <input type="date" value={form.reserved_date} onChange={(e) => update('reserved_date', e.target.value)} className={inputClass} />
          </VehicleField>
          {form.vehicle_status === 'Reserved' && (
            <>
              <VehicleField label="Customer Name *">
                <input type="text" value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} placeholder="Reserving customer" className={inputClass} required />
              </VehicleField>
              <VehicleField label="Customer Email *">
                <input type="email" value={form.customer_email} onChange={(e) => update('customer_email', e.target.value)} placeholder="customer@example.com" className={inputClass} required />
              </VehicleField>
              <VehicleField label="Customer Phone *">
                <input type="tel" value={form.customer_phone} onChange={(e) => update('customer_phone', e.target.value)} placeholder="e.g. 07700 900000" className={inputClass} required />
              </VehicleField>
              <VehicleField label="Deposit Agreement URL">
                <input type="url" value={form.deposit_agreement_url} onChange={(e) => update('deposit_agreement_url', e.target.value)} placeholder="Link to signed agreement" className={inputClass} />
              </VehicleField>
              <VehicleField label="CarPlay Included">
                <select value={form.carplay_included ? 'yes' : 'no'} onChange={(e) => update('carplay_included', e.target.value === 'yes')} className={selectClass}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </VehicleField>
            </>
          )}
          <VehicleField label={form.vehicle_status === 'Reserved' ? 'Deposit Amount (£) *' : 'Deposit Amount (£)'}>
            <input
              type="text"
              inputMode="decimal"
              value={form.deposit_amount}
              onChange={(e) => update('deposit_amount', formatTypingMoney(e.target.value, { treatTrailingDot: true }))}
              placeholder={form.vehicle_status === 'Reserved' ? 'Required (0 if none)' : ''}
              className={inputClass}
              required={form.vehicle_status === 'Reserved'}
            />
          </VehicleField>
          <VehicleField label="Buyers Name">
            <input type="text" value={form.buyers_name} onChange={(e) => update('buyers_name', e.target.value)} className={inputClass} placeholder={form.vehicle_status === 'Reserved' ? 'Same as customer for reserved' : ''} />
          </VehicleField>
          <VehicleField label="Planned Collection Date">
            <input type="date" value={form.planned_collection_date} onChange={(e) => update('planned_collection_date', e.target.value)} className={inputClass} />
          </VehicleField>
          {form.vehicle_status === 'Reserved' && (
            <div className="md:col-span-2 space-y-1">
              <VehicleField label="Customer pickup — important notice">
                <textarea
                  rows={4}
                  value={form.pickup_important_notice}
                  onChange={(e) => update('pickup_important_notice', e.target.value)}
                  placeholder="Optional. Shown in red at top of customer pickup link when filled (delays, documents needed, etc.). Leave blank to hide."
                  className={`${inputClass} resize-y min-h-[5rem]`}
                />
              </VehicleField>
              <p className="text-[11px] text-zinc-500 px-1">
                Visible only on the customer reservation page — clear when no longer needed.
              </p>
            </div>
          )}
          <VehicleField label="Selling Price (£)">
            <input
              type="text"
              inputMode="decimal"
              value={form.selling_price}
              onChange={(e) => update('selling_price', formatTypingMoney(e.target.value, { treatTrailingDot: true }))}
              placeholder="e.g. 12,995"
              className={inputClass}
            />
          </VehicleField>
          <VehicleField label="Warranty">
            <select value={form.warranty} onChange={(e) => update('warranty', e.target.value)} className={selectClass}>
              <option value="">Select</option>
              {WARRANTY_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </VehicleField>
          <VehicleField label="ID Type">
            <input type="text" value={form.id_type} onChange={(e) => update('id_type', e.target.value)} placeholder="e.g. Passport, Driving Licence" className={inputClass} />
          </VehicleField>
          <VehicleField label="Wholesale / Retail">
            <select value={form.wholesale_retail} onChange={(e) => update('wholesale_retail', e.target.value)} className={selectClass}>
              <option value="">Select</option>
              {WHOLESALE_RETAIL.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </VehicleField>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.plate_received} onChange={(e) => update('plate_received', e.target.checked)} className="rounded border-zinc-600 text-amber-500" />
            <span className="text-zinc-300">Plate Received</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ready_pullout} onChange={(e) => update('ready_pullout', e.target.checked)} className="rounded border-zinc-600 text-amber-500" />
            <span className="text-zinc-300">Ready Pullout</span>
          </label>
        </div>
      </AccordionSection>

      {/* 7. Vehicle Condition & Work */}
      <AccordionSection title="7. Vehicle Condition & Work" open={openSections.condition} onToggle={() => toggleSection('condition')} variant="condition">
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.pending_issues} onChange={(e) => update('pending_issues', e.target.checked)} className="rounded border-zinc-600 text-amber-500" />
            <span className="text-zinc-300">Pending Issues</span>
          </label>
        </div>
        {form.pending_issues && (
          <VehicleField label="Pending Issues Details">
            <textarea value={form.pending_issues_details} onChange={(e) => update('pending_issues_details', e.target.value)} rows={2} className={inputClass} />
          </VehicleField>
        )}
        <VehicleField label="Extra Parts">
          <textarea value={form.extra_parts} onChange={(e) => update('extra_parts', e.target.value)} rows={2} className={inputClass} />
        </VehicleField>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {['battery_replaced', 'dial_ordered', 'body_work_required', 'media_system', 'reverse_camera', 'front_camera', 'front_sensor', 'rear_sensor', 'spare_key'].map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form[key]} onChange={(e) => update(key, e.target.checked)} className="rounded border-zinc-600 text-amber-500" />
              <span className="text-zinc-300 text-sm capitalize">{key.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </AccordionSection>

      <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold transition disabled:opacity-50">
        {loading ? 'Saving...' : vehicle ? 'Update Vehicle' : 'Add Vehicle'}
      </button>
    </form>
  )
}
