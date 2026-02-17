import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Activity, CheckCircle, XCircle, Loader2 } from 'lucide-react'

const StatusBadge = ({ ok, label }) => (
  <div className="flex items-center gap-2">
    {ok ? (
      <CheckCircle className="w-5 h-5 text-emerald-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    )}
    <span className={ok ? 'text-emerald-400' : 'text-red-400'}>{label}</span>
  </div>
)

export function Health() {
  const [checks, setChecks] = useState({
    env: false,
    supabase: false,
    supabaseError: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      const hasUrl = !!import.meta.env.VITE_SUPABASE_URL
      const hasKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY
      const envOk = hasUrl && hasKey

      let supabaseOk = false
      let supabaseError = null

      if (envOk) {
        try {
          const { error } = await supabase.from('vehicles').select('id').limit(1)
          supabaseOk = !error
          supabaseError = error?.message ?? null
        } catch (err) {
          supabaseError = err.message
        }
      }

      setChecks({
        env: envOk,
        supabase: supabaseOk,
        supabaseError,
      })
      setLoading(false)
    }
    run()
  }, [])

  const allOk = checks.env && checks.supabase

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Activity className="w-6 h-6 text-orange-500" />
        App Health
      </h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl border ${
              allOk ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-700'
            }`}
          >
            <p className="font-medium text-white mb-1">
              Overall: {allOk ? 'Healthy' : 'Issues detected'}
            </p>
            <p className="text-sm text-slate-400">
              {allOk ? 'All systems operational' : 'Check the items below'}
            </p>
          </div>

          <div className="space-y-3 p-4 rounded-xl bg-slate-800 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Checks</h3>
            <StatusBadge ok={checks.env} label="Environment (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)" />
            <StatusBadge ok={checks.supabase} label="Supabase connection" />
            {checks.supabaseError && (
              <p className="text-sm text-red-400 mt-2 pl-7">{checks.supabaseError}</p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Environment</h3>
            <div className="space-y-1 text-sm font-mono">
              <p>
                <span className="text-slate-500">URL:</span>{' '}
                <span className="text-slate-300">
                  {import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing'}
                </span>
              </p>
              <p>
                <span className="text-slate-500">Anon key:</span>{' '}
                <span className="text-slate-300">
                  {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
