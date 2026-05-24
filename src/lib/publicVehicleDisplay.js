/**
 * Helpers for customer-facing vehicle pages (/find/vehicle/:id, /book/vehicle/:id).
 */

export function formatPublicSellingPriceGbp(price) {
  if (price == null || price === '') return null
  const n = typeof price === 'number' ? price : Number(price)
  if (!Number.isFinite(n) || n <= 0) return null
  return `£${n.toLocaleString('en-GB')}`
}

/** Feature keys where the Sanity object marks them enabled/truthy. */
export function listPublicVehicleFeatureLabels(features) {
  if (!features || typeof features !== 'object') return []
  return Object.entries(features)
    .filter(([, v]) => {
      if (v === true || v === 1) return true
      if (typeof v === 'string') {
        const t = v.trim().toLowerCase()
        return t !== '' && t !== 'false' && t !== 'no' && t !== '0'
      }
      return Boolean(v)
    })
    .map(([k]) => String(k).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'en'))
}
