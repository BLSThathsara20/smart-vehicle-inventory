import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Images } from 'lucide-react'
import { LazyVehicleImage } from './LazyVehicleImage'
import { VEHICLE_IMAGE_PLACEHOLDER } from '../lib/vehicleImages'

/**
 * Full-screen gallery: large view with prev/next and thumbnail strip.
 */
export function VehiclePhotoGalleryModal({ open, onClose, images, title, initialIndex = 0 }) {
  const list = Array.isArray(images) ? images.filter((i) => i?.url) : []
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (open && list.length) {
      setIndex(Math.min(Math.max(0, initialIndex), list.length - 1))
    }
  }, [open, initialIndex, list.length])

  const go = useCallback(
    (delta) => {
      if (!list.length) return
      setIndex((i) => (i + delta + list.length) % list.length)
    },
    [list.length]
  )

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, go])

  if (!open || !list.length) return null

  const current = list[index]
  const url = current?.url || VEHICLE_IMAGE_PLACEHOLDER

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Vehicle photos"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Images className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{title || 'Photos'}</p>
            <p className="text-xs text-zinc-500">
              {index + 1} / {list.length}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700"
          aria-label="Close gallery"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 px-2 py-4 relative">
        {list.length > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-900/90 text-white border border-zinc-700 hover:bg-zinc-800"
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <div className="w-full max-w-4xl max-h-[min(70vh,720px)] aspect-[4/3] rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
          <LazyVehicleImage
            key={url}
            src={url}
            alt={`${title || 'Vehicle'} — photo ${index + 1}`}
            className="w-full h-full"
            imgClassName="object-contain bg-zinc-950"
            priority
          />
        </div>
        {list.length > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-900/90 text-white border border-zinc-700 hover:bg-zinc-800"
            aria-label="Next photo"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950/80 px-3 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map((img, i) => (
            <button
              key={img.id || img.url || i}
              type="button"
              onClick={() => setIndex(i)}
              className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                i === index ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-zinc-700 opacity-80 hover:opacity-100'
              }`}
            >
              <LazyVehicleImage src={img.url} alt="" className="w-full h-full" imgClassName="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
