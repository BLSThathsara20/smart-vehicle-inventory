import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchVehicleById, normalizeVehicleWorkflowInstances } from '../lib/sanityData'
import { WorkPathInstancePanel } from '../components/WorkPathInstancePanel'
import { useAuth } from '../context/AuthContext'
import { useNotification } from '../context/NotificationContext'
import { ArrowLeft, Car, ExternalLink } from 'lucide-react'
import { LazyVehicleImage } from '../components/LazyVehicleImage'
import { LoadingState } from '../components/LoadingState'

export function WorkItemDetail() {
  const { vehicleId, instanceId } = useParams()
  const navigate = useNavigate()
  const { user, profile, hasPermission, canEditWorkPath, isSuperAdmin } = useAuth()
  const { addNotification } = useNotification()
  const canEdit = hasPermission('inventory:edit')
  const canManageWorkflows = canEditWorkPath()
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadMessage, setLoadMessage] = useState('Loading vehicle…')

  const load = useCallback(async () => {
    if (!vehicleId) return
    setLoading(true)
    setLoadMessage('Fetching vehicle…')
    try {
      const data = await fetchVehicleById(vehicleId)
      if (!data) throw new Error('Vehicle not found')
      setVehicle(data)
    } catch (e) {
      addNotification(e.message || 'Could not load vehicle', 'error')
      navigate('/app/my-work')
    } finally {
      setLoading(false)
    }
  }, [vehicleId, addNotification, navigate])

  useEffect(() => {
    load()
  }, [load])

  const instance = useMemo(() => {
    if (!vehicle || !instanceId) return null
    const list = normalizeVehicleWorkflowInstances(vehicle)
    return list.find((x) => x.instance_id === instanceId) || null
  }, [vehicle, instanceId])

  const primaryImage = vehicle?.images?.[0]?.url
  const showApplyBlock = canEdit && !vehicle?.sold

  if (loading) {
    return <LoadingState message={loadMessage} variant="embedded" className="py-24" />
  }

  if (!vehicle || !instance) {
    return (
      <div className="p-4">
        <p className="text-zinc-400">This work path was not found for this vehicle.</p>
        <Link to="/app/my-work" className="text-amber-500 text-sm mt-2 inline-block">
          Back to My work
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <Link
          to="/app/my-work"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          My work
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-4 p-4">
          <div className="sm:w-36 shrink-0 aspect-[4/3] rounded-xl overflow-hidden border border-zinc-800">
            <LazyVehicleImage
              src={primaryImage}
              alt=""
              className="w-full h-full"
              imgClassName="object-cover"
              priority
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start gap-2">
              <Car className="w-5 h-5 text-amber-500/80 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-lg font-semibold text-white leading-tight">
                  {vehicle.brand} {vehicle.model}
                  {vehicle.stock_id != null && vehicle.stock_id !== '' && (
                    <span className="text-zinc-500 font-normal"> · #{vehicle.stock_id}</span>
                  )}
                </h1>
                {(vehicle.year || vehicle.trim) && (
                  <p className="text-sm text-zinc-500 mt-0.5">
                    {[vehicle.year, vehicle.trim].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <Link
              to={`/vehicle/${vehicle.id}`}
              className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-400/95 hover:bg-amber-500/25"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              Full vehicle page
            </Link>
            <p className="text-xs text-zinc-600">
              This view keeps you on the active work path. Use the vehicle page for photos, pricing, and reservation.
            </p>
          </div>
        </div>
      </div>

      <WorkPathInstancePanel
        inst={instance}
        vehicleId={vehicle.id}
        vehicleSold={!!vehicle.sold}
        currentUid={user?.uid}
        currentDisplayName={profile?.display_name || user?.displayName || user?.email || ''}
        canApply={showApplyBlock}
        canManageWorkflows={canManageWorkflows}
        isSuperAdminUser={isSuperAdmin()}
        showApplyBlock={showApplyBlock}
        onUpdate={load}
      />
    </div>
  )
}
