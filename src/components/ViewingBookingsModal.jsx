import { X } from 'lucide-react'
import { ViewingBookingsPanel } from './ViewingBookingsPanel'

export function ViewingBookingsModal({
  open,
  onClose,
  vehicle,
  canEdit,
  currentUid,
  currentDisplayName,
  onUpdate,
}) {
  if (!open || !vehicle) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="pointer-events-auto bg-zinc-900 border border-zinc-700/80 shadow-2xl w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col min-h-0 max-h-[min(92vh,920px)] sm:max-h-[min(88vh,760px)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 p-4 border-b border-zinc-800/80">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white tracking-tight">Viewing appointments</h2>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {vehicle.brand} {vehicle.model}
              {vehicle.stock_id != null && vehicle.stock_id !== '' ? ` · #${vehicle.stock_id}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),0.75rem)] [scrollbar-gutter:stable]">
          <ViewingBookingsPanel
            vehicle={vehicle}
            canEdit={canEdit}
            currentUid={currentUid}
            currentDisplayName={currentDisplayName}
            onUpdate={onUpdate}
            showHeader={false}
          />
        </div>
      </div>
    </div>
  )
}
