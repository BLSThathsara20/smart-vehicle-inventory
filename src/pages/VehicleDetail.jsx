import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { VehicleForm } from '../components/VehicleForm'
import { VehicleCard } from '../components/VehicleCard'
import { getSimilarVehicles } from '../lib/similarVehicles'
import { ArrowLeft, Pencil, Car, X, Loader2, Lock, CheckCircle, Link2, Copy } from 'lucide-react'
import { Footer } from '../components/Footer'
import { ReservationWorkflow } from '../components/ReservationWorkflow'
import { ReserveModal } from '../components/ReserveModal'
import { DETAIL_SECTIONS } from '../lib/vehicleDetailFields'

export function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, hasPermission } = useAuth()
  const { addNotification } = useNotification()
  const canEdit = hasPermission('inventory:edit')
  const canDelete = hasPermission('inventory:delete')
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [similarOpen, setSimilarOpen] = useState(false)
  const [similarVehicles, setSimilarVehicles] = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [editForReservationDetails, setEditForReservationDetails] = useState(false)

  useEffect(() => {
    fetchVehicle()
    setSimilarOpen(false)
  }, [id])

  useEffect(() => {
    if (vehicle && canEdit && searchParams.get('reserve') === '1' && !vehicle.reserved && !vehicle.sold) {
      setReserveOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [vehicle, canEdit, searchParams])

  useEffect(() => {
    if (vehicle && canEdit && searchParams.get('edit') === '1') {
      setEditForReservationDetails(vehicle.reserved && (!vehicle.customer_name || !vehicle.customer_email || !vehicle.customer_phone))
      setEditing(true)
      setSearchParams({}, { replace: true })
    }
  }, [vehicle, canEdit, searchParams])

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
      navigate(user ? '/app' : '/find')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-amber-500/80 animate-spin mb-3" />
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    )
  }
  if (!vehicle) return null

  function generatePickupToken() {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  }

  async function handleGeneratePickupLink() {
    if (!canEdit || !vehicle?.id) return
    setGeneratingLink(true)
    try {
      const token = generatePickupToken()
      const { error } = await supabase.from('vehicles').update({ pickup_token: token }).eq('id', vehicle.id)
      if (error) throw error
      addNotification('Customer link generated', 'success')
      fetchVehicle()
    } catch (err) {
      addNotification(err.message || 'Failed to generate link', 'error')
    } finally {
      setGeneratingLink(false)
    }
  }

  async function copyPickupLink() {
    const path = `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/pickup/${vehicle.pickup_token}`
    const url = new URL(path, window.location.origin).href
    try {
      await navigator.clipboard.writeText(url)
      addNotification('Link copied to clipboard', 'success')
    } catch {
      addNotification('Could not copy', 'error')
    }
  }

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

  async function fetchSimilarOptions() {
    setSimilarOpen(true)
    setSimilarLoading(true)
    setSimilarVehicles([])
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`*, vehicle_images (id, storage_path, sort_order)`)
        .eq('sold', false)
        .eq('reserved', false)
        .neq('id', id)
        .limit(100)

      if (error) throw error

      const withUrls = (data || []).map((v) => {
        const images = (v.vehicle_images || []).map((img) => ({
          ...img,
          url: supabase.storage.from('vehicle-images').getPublicUrl(img.storage_path).data.publicUrl,
        }))
        return { ...v, images }
      })

      const similar = getSimilarVehicles(vehicle, withUrls, 12)
      setSimilarVehicles(similar)
    } catch (err) {
      addNotification(err.message || 'Failed to load similar vehicles', 'error')
    } finally {
      setSimilarLoading(false)
    }
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <main className="max-w-lg md:max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-8">
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-xl font-bold text-white mb-6 tracking-tight">Edit Vehicle</h1>
          <VehicleForm
            vehicle={vehicle}
            onSuccess={() => { setEditing(false); setEditForReservationDetails(false); fetchVehicle(); }}
            initialOpenSale={editForReservationDetails}
          />
        </main>
      </div>
    )
  }

  const primaryImage = vehicle.images?.[0]?.url
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23171717" width="400" height="300"/%3E%3Ctext fill="%23525252" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="24"%3ECar%3C/text%3E%3C/svg%3E'
  const isReserved = vehicle.reserved && !vehicle.sold
  const isSold = vehicle.sold
  const isAvailable = !isSold && !isReserved

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="max-w-lg md:max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-8">
        <div className={!canEdit && !canDelete ? 'pb-8' : ''}>
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            {canEdit && (
              <div className="flex gap-2">
                {isAvailable && (
                  <button
                    onClick={() => setReserveOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 hover:border-amber-500/50 font-medium transition"
                  >
                    <Lock className="w-4 h-4" />
                    Reserve
                  </button>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium transition"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              </div>
            )}
          </div>

          {isReserved && (
            <>
              <div className="mb-6 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Lock className="w-5 h-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">This vehicle is reserved</p>
                      <p className="text-xs text-amber-400/80 mt-0.5">Held for a customer — not available for sale</p>
                      {(vehicle.customer_name || vehicle.customer_phone) && (
                        <p className="text-xs text-amber-400/90 mt-2 font-medium">
                          {vehicle.customer_name}
                          {vehicle.customer_phone && ` · ${vehicle.customer_phone}`}
                        </p>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => { setEditForReservationDetails(true); setEditing(true); }}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 text-amber-400 text-sm font-medium border border-amber-500/40"
                        >
                          {!vehicle.customer_name && !vehicle.customer_email && !vehicle.customer_phone ? 'Add reservation details' : 'Edit reservation details'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {vehicle.deposit_amount != null && (
                      <div className="text-right">
                        <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">Deposit</p>
                        <p className="font-semibold text-amber-400">£{Number(vehicle.deposit_amount).toLocaleString()}</p>
                      </div>
                    )}
                    {vehicle.pickup_token ? (
                      <button
                        type="button"
                        onClick={copyPickupLink}
                        title="Copy customer pickup link"
                        className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    ) : canEdit ? (
                      <button
                        type="button"
                        onClick={handleGeneratePickupLink}
                        disabled={generatingLink}
                        title="Generate customer pickup link"
                        className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50"
                      >
                        {generatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mb-8">
                <ReservationWorkflow vehicleId={vehicle.id} vehicle={vehicle} canEdit={canEdit} onUpdate={fetchVehicle} />
              </div>
            </>
          )}

          {isSold && (
            <div className="mb-6 flex items-center gap-3 px-4 py-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">This vehicle has been sold</p>
                <p className="text-xs text-rose-400/80 mt-0.5">No longer available</p>
              </div>
            </div>
          )}

          {isAvailable && (
            <div className="mb-6 flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <div>
                <p className="font-semibold text-sm">Available for sale</p>
                <p className="text-xs text-emerald-400/80 mt-0.5">Ready to view and purchase</p>
              </div>
            </div>
          )}

          <div className={`rounded-2xl overflow-hidden mb-6 ${
            isSold ? 'bg-rose-950/20 border-2 border-rose-500/30' : isReserved ? 'bg-amber-950/20 border-2 border-amber-500/30' : 'bg-zinc-900/50 border border-zinc-800/60'
          }`}>
            <div className="aspect-[4/3] relative overflow-hidden">
              <img
                src={primaryImage || placeholder}
                alt={`${vehicle.brand} ${vehicle.model}`}
                className={`w-full h-full object-cover ${isReserved ? 'opacity-90' : isSold ? 'opacity-80' : ''}`}
              />
              {isReserved && (
                <div className="absolute inset-0 bg-amber-950/20 pointer-events-none" aria-hidden />
              )}
              {isSold && (
                <div className="absolute inset-0 bg-rose-950/25 pointer-events-none" aria-hidden />
              )}
              {isReserved && (
                <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden pointer-events-none">
                  <div className="absolute top-5 right-[-2.5rem] rotate-45 bg-amber-500/95 text-zinc-950 text-xs font-bold uppercase tracking-wider py-1.5 px-10 shadow-md">
                    Reserved
                  </div>
                </div>
              )}
              {isSold && (
                <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden pointer-events-none">
                  <div className="absolute top-5 right-[-2.5rem] rotate-45 bg-rose-600/95 text-white text-xs font-bold uppercase tracking-wider py-1.5 px-10 shadow-md">
                    Sold
                  </div>
                </div>
              )}
              {isAvailable && (
                <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden pointer-events-none">
                  <div className="absolute top-5 right-[-2.5rem] rotate-45 bg-emerald-500/95 text-zinc-950 text-xs font-bold uppercase tracking-wider py-1.5 px-10 shadow-md">
                    Available
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              <div className="absolute top-4 left-4 flex gap-2">
                {isSold && (
                  <span className="px-3 py-1.5 rounded-xl text-sm font-medium bg-rose-600/90 text-white flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Sold
                  </span>
                )}
                {isReserved && (
                  <span className="px-3 py-1.5 rounded-xl text-sm font-medium bg-amber-600/90 text-white flex items-center gap-1.5">
                    <Lock className="w-4 h-4" /> Reserved
                  </span>
                )}
                <span className="px-3 py-1.5 rounded-xl text-sm font-mono bg-zinc-900/90 text-amber-400">
                  #{vehicle.stock_id}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                {vehicle.brand} {vehicle.model}
              </h1>
              {vehicle.selling_price != null && vehicle.selling_price !== '' && (
                <span className="text-lg font-semibold text-amber-400">
                  £{Number(vehicle.selling_price).toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-zinc-400">
              {vehicle.model_year != null && <span>{vehicle.model_year}</span>}
              {vehicle.mileage != null && <span>{Number(vehicle.mileage).toLocaleString()} miles</span>}
              {vehicle.cc != null && <span>{vehicle.cc} cc</span>}
              {vehicle.body && <span>{vehicle.body}</span>}
            </div>
          </div>

          <div className="mb-8 space-y-6">
            {DETAIL_SECTIONS.map((section) => (
              <div key={section.title} className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/80">
                  {section.title}
                </h3>
                <div className="grid grid-cols-2 gap-3 p-4">
                  {section.fields.map(({ key, label, format, isUrl }) => {
                    const value = vehicle[key]
                    const display = format(value)
                    const isEmpty = display === 'Not added'
                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border ${
                          isEmpty ? 'bg-zinc-800/30 border-zinc-700/50' : 'bg-zinc-800/20 border-zinc-700/60'
                        }`}
                      >
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                        {isUrl && value ? (
                          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:text-amber-300 underline truncate block">
                            View agreement
                          </a>
                        ) : (
                          <p className={`text-sm ${isEmpty ? 'text-zinc-500 italic' : 'text-zinc-300'}`}>{display}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {vehicle.details && (
            <div className="mb-8 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Additional details</h3>
              <p className="text-zinc-300 text-sm leading-relaxed">{vehicle.details}</p>
            </div>
          )}

          {vehicle.features && Object.keys(vehicle.features).length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Features</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(vehicle.features).map(([k, v]) => (
                  <span
                    key={k}
                    className={`px-3 py-1.5 rounded-xl text-sm ${
                      v ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/60'
                    }`}
                  >
                    {k}: {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={fetchSimilarOptions}
            className="w-full py-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 hover:bg-zinc-700/60 hover:border-zinc-600 hover:text-white font-medium flex items-center justify-center gap-2 mb-4 transition"
          >
            <Car className="w-5 h-5" />
            Similar Options
          </button>

          {canDelete && (
            <button
              onClick={handleDelete}
              className="w-full py-3.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-medium transition"
            >
              Delete Vehicle
            </button>
          )}
        </div>

        {similarOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setSimilarOpen(false)}
          >
            <div
              className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl border border-zinc-700/80 shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-5 border-b border-zinc-700/80">
                <h3 className="text-lg font-semibold text-white tracking-tight">Similar Vehicles</h3>
                <button
                  type="button"
                  onClick={() => setSimilarOpen(false)}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {similarLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-10 h-10 text-amber-500/80 animate-spin mb-3" />
                    <p className="text-zinc-500 text-sm">Finding similar vehicles...</p>
                  </div>
                ) : similarVehicles.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-zinc-800/80 flex items-center justify-center">
                      <Car className="w-7 h-7 text-zinc-600" />
                    </div>
                    <p className="text-zinc-400 font-medium">No similar vehicles in stock</p>
                    <p className="text-zinc-600 text-sm mt-1">Browse inventory for alternatives</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {similarVehicles.map((v) => (
                      <div key={v.id} onClick={() => setSimilarOpen(false)}>
                        <VehicleCard vehicle={v} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {reserveOpen && (
          <ReserveModal
            vehicle={vehicle}
            onClose={() => setReserveOpen(false)}
            onSuccess={() => {
              addNotification('Vehicle reserved', 'success')
              fetchVehicle()
            }}
          />
        )}

        <Footer />
      </main>
    </div>
  )
}
