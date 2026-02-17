import { Link } from 'react-router-dom'
import { Car, MapPin, Tag } from 'lucide-react'

export function VehicleCard({ vehicle }) {
  const primaryImage = vehicle.images?.[0]?.url
  const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23334155" width="400" height="300"/%3E%3Ctext fill="%2364748b" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="24"%3ECar%3C/text%3E%3C/svg%3E'

  return (
    <Link
      to={`/vehicle/${vehicle.id}`}
      className="block bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-orange-500/50 transition"
    >
      <div className="aspect-[4/3] bg-slate-700 relative">
        <img
          src={primaryImage || placeholder}
          alt={`${vehicle.brand} ${vehicle.model}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2 flex gap-2">
          {vehicle.sold && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white">Sold</span>
          )}
          {vehicle.reserved && !vehicle.sold && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-600 text-white">Reserved</span>
          )}
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
          <span className="px-2 py-1 rounded bg-slate-900/80 text-xs font-mono text-orange-400">
            #{vehicle.stock_id}
          </span>
          {vehicle.model_year && (
            <span className="text-xs text-slate-300">{vehicle.model_year}</span>
          )}
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-white truncate">
          {vehicle.brand} {vehicle.model}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
          {vehicle.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {vehicle.location}
            </span>
          )}
          {vehicle.plate_no && (
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 flex-shrink-0" />
              {vehicle.plate_no}
            </span>
          )}
        </div>
        {(vehicle.mileage != null || vehicle.price) && (
          <div className="mt-2 flex gap-3 text-xs text-slate-500">
            {vehicle.mileage != null && <span>{vehicle.mileage?.toLocaleString()} miles</span>}
          </div>
        )}
      </div>
    </Link>
  )
}
