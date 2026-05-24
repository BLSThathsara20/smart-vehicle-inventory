import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchVehicleById,
  patchVehicleFields,
  deleteVehicle,
  fetchSimilarVehiclesPool,
  normalizeVehicleWorkflowInstances,
} from '../lib/sanityData'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { VehicleForm } from '../components/VehicleForm'
import { VehicleCard } from '../components/VehicleCard'
import { getSimilarVehicles } from '../lib/similarVehicles'
import { ArrowLeft, Pencil, Car, X, Loader2, Lock, CheckCircle, Link2, Copy, Images, CalendarClock, Package, FileDown, ClipboardCheck, CalendarPlus } from 'lucide-react'
import { LazyVehicleImage } from '../components/LazyVehicleImage'
import { VehiclePhotoGalleryModal } from '../components/VehiclePhotoGalleryModal'
import { LoadingState } from '../components/LoadingState'
import { Footer } from '../components/Footer'
import { ReservationWorkflow } from '../components/ReservationWorkflow'
import { VehicleOpsWorkflow } from '../components/VehicleOpsWorkflow'
import { ViewingBookingsModal } from '../components/ViewingBookingsModal'
import { ReserveModal } from '../components/ReserveModal'
import { DETAIL_SECTIONS } from '../lib/vehicleDetailFields'
import { isNewlyArrivedStatus } from '../lib/vehicleStatus'
import { buildPublicVehicleBookingAbsoluteUrl } from '../lib/publicBookingUrls'

function HeroImageStack({ primaryImage, vehicle, isReserved, isSold, isAvailable, isNewShipment, galleryCount }) {
  return (
    <div className="aspect-[4/3] relative overflow-hidden">
      <LazyVehicleImage
        src={primaryImage}
        alt={`${vehicle.brand} ${vehicle.model}`}
        className="absolute inset-0 w-full h-full"
        imgClassName={isReserved ? 'opacity-90' : isSold ? 'opacity-80' : ''}
        priority
      />
      {isNewShipment && (
        <div className="absolute inset-0 bg-cyan-950/15 pointer-events-none" aria-hidden />
      )}
      {isReserved && (
        <div className="absolute inset-0 bg-amber-950/20 pointer-events-none" aria-hidden />
      )}
      {isSold && <div className="absolute inset-0 bg-rose-950/25 pointer-events-none" aria-hidden />}
      {isNewShipment && (
        <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden pointer-events-none">
          <div className="absolute top-5 right-[-2.5rem] rotate-45 bg-cyan-500/95 text-zinc-950 text-[10px] font-bold uppercase tracking-wider py-1.5 px-10 shadow-md">
            New shipment
          </div>
        </div>
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
      {isAvailable && !isNewShipment && (
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
        {isNewShipment && (
          <span className="px-3 py-1.5 rounded-xl text-sm font-medium bg-cyan-600/90 text-white flex items-center gap-1.5">
            <Package className="w-4 h-4" /> New shipment
          </span>
        )}
        <span className="px-3 py-1.5 rounded-xl text-sm font-mono bg-zinc-900/90 text-amber-400">
          #{vehicle.stock_id}
        </span>
      </div>
      {galleryCount > 0 && (
        <div className="absolute bottom-3 right-3 z-20 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px] font-medium backdrop-blur-sm border border-white/10">
          <Images className="w-3.5 h-3.5 shrink-0" />
          <span>
            {galleryCount} photo{galleryCount === 1 ? '' : 's'} · tap to view
          </span>
        </div>
      )}
    </div>
  )
}

export function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, hasPermission, canEditWorkPath } = useAuth()
  const { addNotification } = useNotification()
  const canEdit = hasPermission('inventory:edit')
  const canViewInventory = hasPermission('inventory:view')
  const canDelete = hasPermission('inventory:delete')
  const canManageWorkflows = canEditWorkPath()
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [similarOpen, setSimilarOpen] = useState(false)
  const [similarVehicles, setSimilarVehicles] = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [editForReservationDetails, setEditForReservationDetails] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [viewingsOpen, setViewingsOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [detailLoadMessage, setDetailLoadMessage] = useState('Fetching vehicle…')
  const [similarLoadMessage, setSimilarLoadMessage] = useState(
    'Loading other vehicles for comparison…'
  )
  const [markingAvailable, setMarkingAvailable] = useState(false)

  useEffect(() => {
    setSimilarOpen(false)
    setVehicle(null)
    setLoading(true)

    async function initialLoad() {
      const loadId = id
      setDetailLoadMessage('Fetching vehicle…')
      try {
        const data = await fetchVehicleById(loadId)
        if (loadId !== id) return
        if (!data) throw new Error('Not found')
        setVehicle(data)
      } catch (err) {
        if (loadId !== id) return
        addNotification(err.message || 'Vehicle not found', 'error')
        navigate(user ? '/app' : '/find')
      } finally {
        if (loadId === id) setLoading(false)
      }
    }

    initialLoad()
  }, [id, user, navigate, addNotification])

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

  useEffect(() => {
    if (!vehicle) return
    if (searchParams.get('viewings') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('viewings')
      setSearchParams(next, { replace: true })
      if (!vehicle.reserved) setViewingsOpen(true)
    }
  }, [vehicle, searchParams, setSearchParams])

  async function refreshVehicle() {
    const loadId = id
    setDetailLoadMessage('Refreshing…')
    try {
      const data = await fetchVehicleById(loadId)
      if (loadId !== id) return
      if (!data) throw new Error('Not found')
      setVehicle(data)
    } catch (err) {
      if (loadId !== id) return
      addNotification(err.message || 'Vehicle not found', 'error')
      navigate(user ? '/app' : '/find')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <LoadingState message={detailLoadMessage} variant="fullscreen" />
      </div>
    )
  }
  if (!vehicle) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <LoadingState message="Opening vehicle…" variant="fullscreen" />
      </div>
    )
  }

  function generatePickupToken() {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  }

  async function handleGeneratePickupLink() {
    if (!canEdit || !vehicle?.id) return
    setGeneratingLink(true)
    try {
      const token = generatePickupToken()
      await patchVehicleFields(vehicle.id, { pickup_token: token })
      addNotification('Customer link generated', 'success')
      refreshVehicle()
    } catch (err) {
      addNotification(err.message || 'Failed to generate link', 'error')
    } finally {
      setGeneratingLink(false)
    }
  }

  async function handleMarkAvailableFromShipment() {
    if (!canEdit || !vehicle?.id || !isNewlyArrivedStatus(vehicle)) return
    setMarkingAvailable(true)
    try {
      await patchVehicleFields(vehicle.id, { vehicle_status: 'Available' })
      addNotification('Vehicle marked as available', 'success')
      await refreshVehicle()
    } catch (err) {
      addNotification(err.message || 'Could not update status', 'error')
    } finally {
      setMarkingAvailable(false)
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

  async function copyCustomerBookingLink() {
    if (!vehicle?.id) return
    try {
      const url = buildPublicVehicleBookingAbsoluteUrl(vehicle.id)
      await navigator.clipboard.writeText(url)
      addNotification('Booking link copied — customer can choose a viewing time online', 'success')
    } catch {
      addNotification('Could not copy link', 'error')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this vehicle?')) return
    try {
      await deleteVehicle(id)
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
    setSimilarLoadMessage('Loading other vehicles for comparison…')
    try {
      const withUrls = await fetchSimilarVehiclesPool(id)
      setSimilarLoadMessage('Picking similar vehicles from loaded stock…')
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
            onSuccess={() => { setEditing(false); setEditForReservationDetails(false); refreshVehicle(); }}
            initialOpenSale={editForReservationDetails}
          />
        </main>
      </div>
    )
  }

  const primaryImage = vehicle.images?.[0]?.url
  const galleryImages = vehicle.images || []
  const hasGallery = galleryImages.length > 0
  const isReserved = vehicle.reserved && !vehicle.sold
  const isSold = vehicle.sold
  const isNewlyArrived = isNewlyArrivedStatus(vehicle)
  const isAvailable = !isSold && !isReserved && !isNewlyArrived
  const isNewShipment = isNewlyArrived && !isReserved && !isSold
  const scheduledViewingCount = (vehicle.viewing_bookings || []).filter(
    (b) => (b.status || 'scheduled') === 'scheduled'
  ).length
  const showViewingsEntry = canViewInventory && !isReserved
  const showCustomerBookingShare = canViewInventory && !isSold && !isReserved
  const workflowInstanceCount = normalizeVehicleWorkflowInstances(vehicle).length
  const showCollectionReport =
    canViewInventory &&
    (isReserved || workflowInstanceCount > 0 || Boolean(vehicle.planned_collection_date))

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
            {(canEdit || showViewingsEntry || showCustomerBookingShare) && (
              <div className="flex flex-wrap gap-2 justify-end">
                {showCustomerBookingShare && (
                  <button
                    type="button"
                    onClick={copyCustomerBookingLink}
                    title="Copy customer link — book a viewing"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/25 font-medium transition"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Share booking link
                  </button>
                )}
                {showViewingsEntry && (
                  <button
                    type="button"
                    onClick={() => setViewingsOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/35 text-sky-400 hover:bg-sky-500/25 font-medium transition"
                  >
                    <CalendarClock className="w-4 h-4" />
                    Viewings
                    {scheduledViewingCount > 0 ? (
                      <span className="tabular-nums text-xs opacity-90">({scheduledViewingCount})</span>
                    ) : null}
                  </button>
                )}
                {canEdit && (
                  <>
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
                  </>
                )}
              </div>
            )}
          </div>

          {isNewShipment && (
            <div className="mb-6 relative group/newship z-30 inline-block max-w-full">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-cyan-600/90 text-white cursor-help shadow-sm border border-cyan-400/30">
                <Package className="w-4 h-4 shrink-0" />
                New shipment
              </span>
              <div className="absolute left-0 top-full pt-2 opacity-0 invisible pointer-events-none group-hover/newship:opacity-100 group-hover/newship:visible group-hover/newship:pointer-events-auto transition-opacity duration-150">
                <div className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-cyan-500/35 bg-zinc-900/95 backdrop-blur-md shadow-xl px-3.5 py-3 text-left">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    This unit is still being prepared. When it is ready for sale, set status to{' '}
                    <span className="text-emerald-400 font-medium">Available</span>.
                  </p>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={handleMarkAvailableFromShipment}
                      disabled={markingAvailable}
                      className="mt-3 w-full sm:w-auto px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition"
                    >
                      {markingAvailable ? 'Updating…' : 'Mark as Available'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

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
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => { setEditForReservationDetails(true); setEditing(true); }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 text-amber-400 text-sm font-medium border border-amber-500/40"
                          >
                            {!vehicle.customer_name && !vehicle.customer_email && !vehicle.customer_phone ? 'Add reservation details' : 'Edit reservation details'}
                          </button>
                        )}
                      </div>
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
                <ReservationWorkflow vehicleId={vehicle.id} vehicle={vehicle} canEdit={canEdit} onUpdate={refreshVehicle} />
              </div>
              {showCollectionReport && (
                <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0 border border-emerald-500/25">
                      <ClipboardCheck className="w-5 h-5 text-emerald-400" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm">PDI &amp; collection report</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                        Pre-delivery inspection checklist, tyre tread, PDI PDF, and full pulout PDF are all on this page.
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/app/collection/${vehicle.id}`}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shrink-0 transition"
                  >
                    Open collection page
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              )}
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

          <div className="mb-6">
            {showCollectionReport && !isReserved && (
              <div className="mb-3 flex flex-wrap justify-end">
                <Link
                  to={`/app/collection/${vehicle.id}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/90 border border-zinc-700 text-zinc-200 text-sm font-medium hover:bg-zinc-700/90 transition"
                >
                  <FileDown className="w-4 h-4 shrink-0 text-amber-400" />
                  Pulout &amp; prep report (PDF)
                </Link>
              </div>
            )}
            <VehicleOpsWorkflow
              vehicle={vehicle}
              currentUid={user?.uid}
              currentDisplayName={profile?.display_name || user?.displayName || user?.email || ''}
              onUpdate={refreshVehicle}
              canApply={canEdit && !vehicle.sold}
              canManageWorkflows={canManageWorkflows}
            />
          </div>

          <div className={`rounded-2xl overflow-hidden mb-6 ${
            isSold
              ? 'bg-rose-950/20 border-2 border-rose-500/30'
              : isReserved
                ? 'bg-amber-950/20 border-2 border-amber-500/30'
                : isNewShipment
                  ? 'bg-cyan-950/15 border-2 border-cyan-500/25'
                  : 'bg-zinc-900/50 border border-zinc-800/60'
          }`}>
            {hasGallery ? (
              <button
                type="button"
                onClick={() => {
                  setGalleryIndex(0)
                  setGalleryOpen(true)
                }}
                className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-t-2xl"
                aria-label={`Open photo gallery, ${galleryImages.length} photos`}
              >
                <HeroImageStack
                  primaryImage={primaryImage}
                  vehicle={vehicle}
                  isReserved={isReserved}
                  isSold={isSold}
                  isAvailable={isAvailable}
                  isNewShipment={isNewShipment}
                  galleryCount={galleryImages.length}
                />
              </button>
            ) : (
              <div className="rounded-t-2xl">
                <HeroImageStack
                  primaryImage={primaryImage}
                  vehicle={vehicle}
                  isReserved={isReserved}
                  isSold={isSold}
                  isAvailable={isAvailable}
                  isNewShipment={isNewShipment}
                  galleryCount={0}
                />
              </div>
            )}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 px-2 py-2 overflow-x-auto border-t border-zinc-800/60 bg-zinc-900/40">
                {galleryImages.map((img, i) => (
                  <button
                    key={img.id || img.url || i}
                    type="button"
                    onClick={() => {
                      setGalleryIndex(i)
                      setGalleryOpen(true)
                    }}
                    className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                      i === 0 ? 'border-amber-500/60' : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                    aria-label={`Open gallery at photo ${i + 1}`}
                  >
                    <LazyVehicleImage src={img.url} alt="" className="w-full h-full" imgClassName="object-cover" />
                  </button>
                ))}
              </div>
            )}
            {hasGallery && (
              <div className="px-3 py-2.5 border-t border-zinc-800/60 bg-zinc-900/30 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setGalleryIndex(0)
                    setGalleryOpen(true)
                  }}
                  className="inline-flex items-center gap-2 text-xs font-medium text-amber-400 hover:text-amber-300"
                >
                  <Images className="w-4 h-4" />
                  View all {galleryImages.length} photo{galleryImages.length === 1 ? '' : 's'}
                </button>
              </div>
            )}
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
                  {section.fields.map(({ key, label, format, isUrl, pendingWhenEmpty }) => {
                    const value = vehicle[key]
                    const pendingPlateMissing =
                      pendingWhenEmpty &&
                      (value == null || (typeof value === 'string' && value.trim() === ''))
                    const display = pendingPlateMissing ? 'Pending number plate' : format(value)
                    const isEmpty = display === 'Not added'
                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border ${
                          pendingPlateMissing
                            ? 'bg-orange-950/25 border-orange-500/35'
                            : isEmpty
                              ? 'bg-zinc-800/30 border-zinc-700/50'
                              : 'bg-zinc-800/20 border-zinc-700/60'
                        }`}
                      >
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                        {isUrl && value ? (
                          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:text-amber-300 underline truncate block">
                            View agreement
                          </a>
                        ) : (
                          <p
                            className={`text-sm ${
                              pendingPlateMissing
                                ? 'text-orange-300 font-medium'
                                : isEmpty
                                  ? 'text-zinc-500 italic'
                                  : 'text-zinc-300'
                            }`}
                          >
                            {display}
                          </p>
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
                  <LoadingState message={similarLoadMessage} variant="embedded" className="py-16" />
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
              refreshVehicle()
            }}
          />
        )}

        <ViewingBookingsModal
          open={viewingsOpen}
          onClose={() => setViewingsOpen(false)}
          vehicle={vehicle}
          canEdit={canEdit}
          currentUid={user?.uid}
          currentDisplayName={profile?.display_name || user?.displayName || user?.email || ''}
          onUpdate={refreshVehicle}
        />

        <VehiclePhotoGalleryModal
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          images={galleryImages}
          title={`${vehicle.brand} ${vehicle.model}`}
          initialIndex={galleryIndex}
        />

        <Footer />
      </main>
    </div>
  )
}
