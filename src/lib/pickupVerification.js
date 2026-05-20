export function normalizePlate(s) {
  return (s || '').toUpperCase().replace(/\s/g, '')
}

export function normalizeStockId(s) {
  return String(s ?? '')
    .trim()
    .replace(/^#+/i, '')
    .replace(/\s/g, '')
    .toUpperCase()
}

/** True if the customer’s entered value matches this vehicle’s plate or stock id. */
export function verificationMatches(input, vehicle) {
  if (!vehicle || !String(input || '').trim()) return false
  const raw = String(input).trim()
  if (vehicle.plate_no && normalizePlate(raw) && normalizePlate(raw) === normalizePlate(vehicle.plate_no)) {
    return true
  }
  if (
    vehicle.stock_id != null &&
    String(vehicle.stock_id).trim() !== '' &&
    normalizeStockId(raw) &&
    normalizeStockId(raw) === normalizeStockId(vehicle.stock_id)
  ) {
    return true
  }
  return false
}

export function pickupNeedsPlateOrStockVerification(vehicle) {
  if (!vehicle) return false
  return (
    (vehicle.plate_no && String(vehicle.plate_no).trim() !== '') ||
    (vehicle.stock_id != null && String(vehicle.stock_id).trim() !== '')
  )
}

export const pickupVerifiedStorageKey = (token) => `pickup_verified_${token}`
