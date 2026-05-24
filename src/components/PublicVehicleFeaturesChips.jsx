import { listPublicVehicleFeatureLabels } from '../lib/publicVehicleDisplay'

export function PublicVehicleFeaturesChips({ features, sectionClassName = 'pt-2 border-t border-zinc-800' }) {
  const labels = listPublicVehicleFeatureLabels(features)
  if (labels.length === 0) return null
  return (
    <div className={sectionClassName}>
      <p className="text-zinc-500 text-xs uppercase mb-2 tracking-wider">Features</p>
      <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
        {labels.map((label) => (
          <li
            key={label}
            className="px-2.5 py-1 rounded-lg text-xs sm:text-sm bg-amber-500/12 text-amber-300 border border-amber-500/25"
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}
