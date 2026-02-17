import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { VehicleCard } from '../components/VehicleCard'
import { useNotification } from '../context/NotificationContext'
import { Car, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 12

export function VehicleList() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { addNotification } = useNotification()

  useEffect(() => {
    fetchVehicles()
  }, [filter, page])

  async function fetchVehicles() {
    setLoading(true)
    try {
      let qb = supabase
        .from('vehicles')
        .select(
          `
          *,
          vehicle_images (
            id,
            storage_path,
            sort_order
          )
        `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })

      if (filter === 'available') qb = qb.eq('sold', false).eq('reserved', false)
      if (filter === 'sold') qb = qb.eq('sold', true)
      if (filter === 'reserved') qb = qb.eq('reserved', true).neq('sold', true)

      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error, count } = await qb.range(from, to)

      if (error) throw error

      const withUrls = (data || []).map((v) => {
        const images = (v.vehicle_images || []).map((img) => ({
          ...img,
          url: supabase.storage.from('vehicle-images').getPublicUrl(img.storage_path).data.publicUrl,
        }))
        return { ...v, images }
      })

      setVehicles(withUrls)
      setTotalCount(count ?? 0)
    } catch (err) {
      addNotification(err.message || 'Failed to load vehicles', 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Car className="w-6 h-6 text-orange-500" />
        Vehicle Inventory
      </h1>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
        {['all', 'available', 'sold', 'reserved'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1) }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === f
                ? 'bg-orange-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Car className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No vehicles found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 py-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!hasPrev}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-slate-400 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!hasNext}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
