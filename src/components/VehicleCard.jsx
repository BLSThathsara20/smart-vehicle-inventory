import { Link } from 'react-router-dom'
import { MapPin, Tag, Package, KeyRound, CircleDashed } from 'lucide-react'
import { normalizeVehicleWorkflowInstances, getWorkflowDeadlineVisual } from '../lib/sanityData'
import { LazyVehicleImage } from './LazyVehicleImage'
import { isNewlyArrivedStatus } from '../lib/vehicleStatus'

export function VehicleCard({ vehicle, linkToDetail = true, modelCount, detailTo }) {
  const plateDisplay = vehicle.plate_no != null ? String(vehicle.plate_no).trim() : ''
  const pendingPlate = !plateDisplay
  const primaryImage = vehicle.images?.[0]?.url
  const isReserved = vehicle.reserved && !vehicle.sold
  const isSold = vehicle.sold
  const isNewlyArrived = isNewlyArrivedStatus(vehicle)
  const isAvailable = !isSold && !isReserved && !isNewlyArrived
  const showNewShipmentChrome = isNewlyArrived && !isReserved && !isSold
  const linkTarget = detailTo ?? `/vehicle/${vehicle.id}`

  const statusStyles = {
    available: 'border border-zinc-800/60 bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5',
    newShipment: 'border border-cyan-500/40 bg-cyan-950/20 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10',
    reserved: 'border-2 border-emerald-500/45 bg-emerald-950/25 hover:border-emerald-500/55 shadow-md shadow-emerald-500/5',
    sold: 'border-2 border-emerald-600/50 bg-emerald-950/35 hover:border-emerald-500/55 shadow-md shadow-emerald-950/20',
  }
  const cardClass = isSold
    ? statusStyles.sold
    : isReserved
      ? statusStyles.reserved
      : showNewShipmentChrome
        ? statusStyles.newShipment
        : statusStyles.available

  const cardContent = (
    <>
      <div className="aspect-[4/3] bg-zinc-950 relative overflow-hidden">
        <LazyVehicleImage
          src={primaryImage}
          alt={`${vehicle.brand} ${vehicle.model}`}
          className="absolute inset-0 w-full h-full"
          imgClassName={`group-hover:scale-[1.02] transition-transform duration-500 ${
            isReserved ? 'opacity-90' : isSold ? 'opacity-75' : showNewShipmentChrome ? 'opacity-95' : ''
          }`}
        />
        {showNewShipmentChrome && (
          <div className="absolute inset-0 bg-cyan-950/20 pointer-events-none" aria-hidden />
        )}
        {isReserved && !isSold && (
          <div className="absolute inset-0 bg-emerald-950/30 pointer-events-none" aria-hidden />
        )}
        {isSold && (
          <div className="absolute inset-0 bg-emerald-950/40 pointer-events-none" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {(isReserved || isSold) && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none p-4"
            aria-hidden
          >
            <div className="rounded-2xl border border-emerald-400/35 bg-zinc-950/70 px-6 py-4 sm:px-8 sm:py-5 backdrop-blur-md shadow-[0_12px_48px_rgba(0,0,0,0.5)]">
              <p
                className={`text-center text-[1.35rem] sm:text-2xl font-black uppercase tracking-[0.28em] leading-tight ${isSold ? 'text-lime-400' : 'text-emerald-400'}`}
                style={{
                  textShadow:
                    '0 0 40px rgba(52, 211, 153, 0.5), 0 2px 4px rgba(0,0,0,0.8)',
                }}
              >
                {isSold ? 'Sold' : 'Reserved'}
              </p>
              <p className="mt-2 text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-emerald-200/80">
                {isSold ? 'Collection complete' : 'Awaiting collection'}
              </p>
            </div>
          </div>
        )}
        {showNewShipmentChrome && (
          <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
            <div className="absolute top-4 right-[-2rem] rotate-45 bg-cyan-500/90 text-zinc-950 text-[9px] font-bold uppercase tracking-wider py-1 px-6 shadow-sm leading-tight text-center">
              New shipment
            </div>
          </div>
        )}
        {isAvailable && (
          <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
            <div className="absolute top-4 right-[-2rem] rotate-45 bg-emerald-500/90 text-zinc-950 text-[10px] font-bold uppercase tracking-wider py-1 px-8 shadow-sm">
              Available
            </div>
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2 pointer-events-none">
          {showNewShipmentChrome && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-600/90 text-white backdrop-blur-sm flex items-center gap-1">
              <Package className="w-3 h-3" /> New shipment
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
          <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 backdrop-blur-sm text-[11px] font-mono text-amber-400 tracking-wide">
            #{vehicle.stock_id}
          </span>
        </div>
      </div>
      <div className={`p-4 ${
        isReserved
          ? 'border-t border-emerald-500/25'
          : isSold
            ? 'border-t border-emerald-500/30'
            : showNewShipmentChrome
              ? 'border-t border-cyan-500/20'
              : isAvailable
                ? 'border-t border-emerald-500/10'
                : ''
      }`}>
        <h3 className="font-semibold text-white text-[15px] tracking-tight truncate">
          {vehicle.brand} {vehicle.model}
          {modelCount != null && modelCount > 1 && (
            <span className="ml-1.5 text-zinc-500 font-normal">({modelCount})</span>
          )}
        </h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-zinc-500">
          {vehicle.model_year != null && <span>{vehicle.model_year}</span>}
          {vehicle.mileage != null && <span>{Number(vehicle.mileage).toLocaleString()} miles</span>}
          {vehicle.cc != null && <span>{vehicle.cc} cc</span>}
          {vehicle.selling_price != null && vehicle.selling_price !== '' && (
            <span className="text-amber-400 font-medium">£{Number(vehicle.selling_price).toLocaleString()}</span>
          )}
        </div>
        {(() => {
          const activeWf = normalizeVehicleWorkflowInstances(vehicle).filter((i) => i.status === 'active')
          if (!activeWf.length) return null
          return (
            <div className="mt-2 flex flex-wrap gap-1">
              {activeWf.map((inst) => {
                const vis = getWorkflowDeadlineVisual(inst)
                const cls =
                  vis.tone === 'overdue'
                    ? 'bg-red-500/15 text-red-400 border-red-500/35'
                    : vis.tone === 'due_soon'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/35'
                      : vis.tone === 'urgent'
                        ? 'bg-orange-500/15 text-orange-300 border-orange-500/35'
                        : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                return (
                  <span
                    key={inst.instance_id}
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${cls}`}
                  >
                    {inst.template_name}
                    {vis.label ? ` · ${vis.label}` : ''}
                  </span>
                )
              })}
            </div>
          )
        })()}
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-600">
          {vehicle.location && (
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
              {vehicle.location}
            </span>
          )}
          {vehicle.car_key_location != null && vehicle.car_key_location !== '' && (
            <span
              className="flex items-center gap-1.5 font-semibold tabular-nums text-violet-400"
              title="Car key location"
            >
              <KeyRound className="w-3.5 h-3.5 text-violet-400/90 flex-shrink-0" aria-hidden />
              Key #{vehicle.car_key_location}
            </span>
          )}
          {pendingPlate ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-orange-500/45 bg-orange-500/10 px-2 py-0.5 font-medium text-orange-300"
              title="Registration plate not entered yet"
            >
              <CircleDashed className="w-3.5 h-3.5 text-orange-300/95 flex-shrink-0" aria-hidden />
              Pending number plate
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Tag className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" aria-hidden />
              {plateDisplay}
            </span>
          )}
        </div>
      </div>
    </>
  )

  const cardClassWithCursor = `${cardClass} ${linkToDetail ? 'cursor-pointer' : 'cursor-default'}`
  const wrapperClass = `group block rounded-2xl overflow-hidden transition-all duration-300 relative ${cardClassWithCursor}`

  return linkToDetail ? (
    <Link to={linkTarget} className={wrapperClass}>
      {cardContent}
    </Link>
  ) : (
    <div className={wrapperClass}>
      {cardContent}
    </div>
  )
}
