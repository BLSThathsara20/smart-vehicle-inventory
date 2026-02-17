import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Database, HardDrive, Loader2, Package } from 'lucide-react'

const FREE_DB_LIMIT_MB = 500
const FREE_STORAGE_LIMIT_MB = 1024

function formatBytes(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${bytes} B`
}

function ProgressBar({ used, limit, label }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const isNearLimit = pct >= 80
  const isOver = pct >= 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className={isOver ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-slate-300'}>
          {formatBytes(used)} / {formatBytes(limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOver ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-orange-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function Space() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSpace = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: result, error: err } = await supabase.rpc('get_space_usage')
        if (err) throw err
        setData(result)
      } catch (err) {
        setError(err.message || 'Failed to load space usage')
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    fetchSpace()
  }, [])

  if (loading) {
    return (
      <div>
        <h1 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-orange-500" />
          Storage & Space
        </h1>
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-orange-500" />
          Storage & Space
        </h1>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
        <p className="text-slate-500 text-sm mt-2">
          Run the migration <code className="bg-slate-800 px-1 rounded">003_get_space_usage.sql</code> in
          Supabase SQL Editor to enable this feature.
        </p>
      </div>
    )
  }

  const dbBytes = data?.db_size_bytes ?? 0
  const storageBytes = data?.storage_size_bytes ?? 0
  const dbLimitBytes = FREE_DB_LIMIT_MB * 1024 * 1024
  const storageLimitBytes = FREE_STORAGE_LIMIT_MB * 1024 * 1024
  const buckets = data?.buckets ?? []

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <HardDrive className="w-6 h-6 text-orange-500" />
        Storage & Space
      </h1>

      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Database
          </h3>
          <p className="text-2xl font-bold text-white mb-2">{data?.db_size_pretty ?? '—'}</p>
          <ProgressBar
            used={dbBytes}
            limit={dbLimitBytes}
            label="Free tier limit: 500 MB"
          />
        </div>

        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            Storage (files)
          </h3>
          <p className="text-2xl font-bold text-white mb-2">{data?.storage_size_pretty ?? '—'}</p>
          <ProgressBar
            used={storageBytes}
            limit={storageLimitBytes}
            label="Free tier limit: 1 GB"
          />
        </div>

        {buckets?.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Buckets
            </h3>
            <div className="space-y-2">
              {buckets.map((b) => (
                <div
                  key={b.bucket_id}
                  className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0"
                >
                  <span className="text-slate-300 font-mono text-sm">{b.bucket_id}</span>
                  <span className="text-orange-400 font-medium">{b.size_pretty}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <p className="text-slate-500 text-xs">
            Free tier limits: 500 MB database, 1 GB storage. Upgrade to Pro for more capacity.
          </p>
        </div>
      </div>
    </div>
  )
}
