/**
 * Compute similarity score between two vehicles.
 * Higher score = more similar.
 * Only in-stock vehicles (sold=false, reserved=false) should be passed.
 */
export function scoreSimilarity(current, candidate) {
  if (current.id === candidate.id) return -1
  if (candidate.sold || candidate.reserved) return -1

  let score = 0

  // Same brand - strong match
  if (current.brand && candidate.brand && current.brand.toLowerCase() === candidate.brand.toLowerCase()) {
    score += 4
  }

  // Same model - very strong
  if (current.model && candidate.model && current.model.toLowerCase() === candidate.model.toLowerCase()) {
    score += 3
  }

  // Same body type
  if (current.body && candidate.body && current.body.toLowerCase() === candidate.body.toLowerCase()) {
    score += 2
  }

  // Same fuel type
  if (current.fuel_type && candidate.fuel_type && current.fuel_type.toLowerCase() === candidate.fuel_type.toLowerCase()) {
    score += 1.5
  }

  // Same gear type
  if (current.gear && candidate.gear && current.gear.toLowerCase() === candidate.gear.toLowerCase()) {
    score += 1
  }

  // Similar model year (within 2 years = strong, within 5 = weak)
  if (current.model_year && candidate.model_year) {
    const diff = Math.abs(current.model_year - candidate.model_year)
    if (diff === 0) score += 2
    else if (diff <= 2) score += 1.5
    else if (diff <= 5) score += 0.5
  }

  // Similar mileage (within 20% = strong, within 50% = weak)
  if (current.mileage != null && candidate.mileage != null && current.mileage > 0) {
    const ratio = candidate.mileage / current.mileage
    if (ratio >= 0.8 && ratio <= 1.2) score += 1.5
    else if (ratio >= 0.5 && ratio <= 1.5) score += 0.5
  }

  // Similar engine CC (within 25%)
  if (current.cc != null && candidate.cc != null && current.cc > 0) {
    const ratio = candidate.cc / current.cc
    if (ratio >= 0.75 && ratio <= 1.25) score += 1
    else if (ratio >= 0.5 && ratio <= 1.5) score += 0.3
  }

  return score
}

/**
 * Sort vehicles by similarity score (descending), filter out current and non-matching.
 */
export function getSimilarVehicles(currentVehicle, allVehicles, limit = 12) {
  const scored = allVehicles
    .map((v) => ({ vehicle: v, score: scoreSimilarity(currentVehicle, v) }))
    .filter(({ score }) => score > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(({ vehicle }) => vehicle)
}
