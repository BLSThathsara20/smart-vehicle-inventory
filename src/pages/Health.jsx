import { useState, useEffect } from 'react'
import { hasFirebaseConfig } from '../lib/firebase'
import { hasSanityConfig } from '../lib/sanity'
import { sanityPing } from '../lib/sanityData'
import { hasImgbbConfig } from '../lib/imgbb'
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
    firebase: false,
    sanity: false,
    sanityError: null,
    imgbb: false,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      const fb = hasFirebaseConfig()
      const imgbb = hasImgbbConfig
      let san = false
      let sanityError = null
      if (hasSanityConfig) {
        const r = await sanityPing()
        san = r.ok
        sanityError = r.error
      }
      setChecks({ firebase: fb, sanity: san, sanityError, imgbb })
      setLoading(false)
    }
    run()
  }, [])

  const envOk = checks.firebase && hasSanityConfig && checks.imgbb
  const allOk = envOk && checks.sanity

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
            <StatusBadge ok={checks.firebase} label="Firebase Auth (VITE_FIREBASE_*)" />
            <StatusBadge ok={hasSanityConfig} label="Sanity env (project, dataset, token)" />
            <StatusBadge ok={checks.sanity} label="Sanity API (query)" />
            {checks.sanityError && (
              <p className="text-sm text-red-400 mt-2 pl-7">{checks.sanityError}</p>
            )}
            <StatusBadge ok={checks.imgbb} label="ImgBB (VITE_IMGBB_API_KEY)" />
          </div>
        </div>
      )}
    </div>
  )
}
