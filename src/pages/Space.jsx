import { HardDrive } from 'lucide-react'

export function Space() {
  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <HardDrive className="w-6 h-6 text-orange-500" />
        Storage & Space
      </h1>
      <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm space-y-3">
        <p>
          Storage usage is no longer tracked in-app. Vehicle photos are hosted on{' '}
          <strong className="text-white">ImgBB</strong>; structured data lives in{' '}
          <strong className="text-white">Sanity</strong>.
        </p>
        <p className="text-slate-500">
          Check your ImgBB and Sanity project dashboards for quotas and usage.
        </p>
      </div>
    </div>
  )
}
