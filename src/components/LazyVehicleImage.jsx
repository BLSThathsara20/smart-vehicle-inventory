import { useState } from 'react'
import { VEHICLE_IMAGE_PLACEHOLDER } from '../lib/vehicleImages'

/**
 * Vehicle photo with skeleton until load; lazy by default for list/grid performance.
 */
export function LazyVehicleImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  /** First / hero image: eager load + high fetch priority */
  priority = false,
}) {
  const [loaded, setLoaded] = useState(false)
  const resolved = src?.trim() ? src : VEHICLE_IMAGE_PLACEHOLDER
  const isPlaceholder = resolved === VEHICLE_IMAGE_PLACEHOLDER

  return (
    <div className={`relative overflow-hidden bg-zinc-800 ${className}`}>
      {!loaded && !isPlaceholder && (
        <div
          className="absolute inset-0 z-[1] animate-pulse bg-gradient-to-br from-zinc-800 via-zinc-800 to-zinc-900"
          aria-hidden
        />
      )}
      <img
        src={resolved}
        alt={alt}
        className={`relative z-[2] w-full h-full object-cover transition-opacity duration-300 ${
          loaded || isPlaceholder ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  )
}
