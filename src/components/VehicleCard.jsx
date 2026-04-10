import { Link } from 'react-router-dom'
import { MapPin, Tag, Lock, CheckCircle } from 'lucide-react'
import { normalizeVehicleWorkflowInstances, getWorkflowDeadlineVisual } from '../lib/sanityData'

export function VehicleCard({ vehicle, linkToDetail = true, modelCount }) {
  const primaryImage = vehicle.images?.[0]?.url
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23171717" width="400" height="300"/%3E%3Ctext fill="%23525252" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="20" font-family="system-ui"%3ECar%3C/text%3E%3C/svg%3E'
  const isReserved = vehicle.reserved && !vehicle.sold
  const isSold = vehicle.sold
  const isAvailable = !isSold && !isReserved

  const statusStyles = {
    available: 'border border-zinc-800/60 bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5',
    reserved: 'border-2 border-amber-500/50 bg-amber-950/30 hover:border-amber-500/60 shadow-md shadow-amber-500/5',
    sold: 'border-2 border-rose-500/40 bg-rose-950/20 hover:border-rose-500/50 shadow-md shadow-rose-500/5',
  }
  const cardClass = isSold ? statusStyles.sold : isReserved ? statusStyles.reserved : statusStyles.available

  const cardContent = (
    <>
      <div className="aspect-[4/3] bg-zinc-950 relative overflow-hidden">
        <img
          src={primaryImage || placeholder}
          alt={`${vehicle.brand} ${vehicle.model}`}
          className={`w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 ${
            isReserved ? 'opacity-90' : isSold ? 'opacity-75' : ''
          }`}
        />
        {isReserved && (
          <div className="absolute inset-0 bg-amber-950/25 pointer-events-none" aria-hidden />
        )}
        {isSold && (
          <div className="absolute inset-0 bg-rose-950/30 pointer-events-none" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {isReserved && (
          <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
            <div className="absolute top-4 right-[-2rem] rotate-45 bg-amber-500/90 text-zinc-950 text-[10px] font-bold uppercase tracking-wider py-1 px-8 shadow-sm">
              Reserved
            </div>
          </div>
        )}
        {isSold && (
          <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
            <div className="absolute top-4 right-[-2rem] rotate-45 bg-rose-600/95 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-8 shadow-sm">
              Sold
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
        <div className="absolute top-3 left-3 flex gap-2">
          {isSold && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-rose-600/90 text-white backdrop-blur-sm flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Sold
            </span>
          )}
          {isReserved && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-600/90 text-white backdrop-blur-sm flex items-center gap-1">
              <Lock className="w-3 h-3" /> Reserved
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
        isReserved ? 'border-t border-amber-500/20' : isSold ? 'border-t border-rose-500/20' : isAvailable ? 'border-t border-emerald-500/10' : ''
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
          {vehicle.plate_no && (
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
              {vehicle.plate_no}
            </span>
          )}
        </div>
      </div>
    </>
  )

  const cardClassWithCursor = `${cardClass} ${linkToDetail ? 'cursor-pointer' : 'cursor-default'}`
  const wrapperClass = `group block rounded-2xl overflow-hidden transition-all duration-300 relative ${cardClassWithCursor}`

  return linkToDetail ? (
    <Link to={`/vehicle/${vehicle.id}`} className={wrapperClass}>
      {cardContent}
    </Link>
  ) : (
    <div className={wrapperClass}>
      {cardContent}
    </div>
  )
}
