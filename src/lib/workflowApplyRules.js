/** When a work path template may be applied to a vehicle (optional gate). */

export const APPLY_WHEN_OPTIONS = [
  { value: 'always', label: 'Any time (no restriction)' },
  { value: 'reserved_only', label: 'Only after vehicle is reserved' },
  { value: 'available_listed_only', label: 'Only while listed (available, not reserved)' },
]

export function applyWhenLabel(value) {
  return APPLY_WHEN_OPTIONS.find((o) => o.value === value)?.label || 'Any time'
}

/**
 * @param {{ sold?: boolean, reserved?: boolean } | null | undefined} vehicle
 * @param {string} applyWhen - always | reserved_only | available_listed_only
 */
export function vehicleMeetsApplyWhen(vehicle, applyWhen) {
  const gate = applyWhen || 'always'
  if (gate === 'always') return { ok: true }

  if (gate === 'reserved_only') {
    if (vehicle?.sold) return { ok: false, message: 'This vehicle is sold — this work path can only start on reserved stock.' }
    if (!vehicle?.reserved) {
      return { ok: false, message: 'This work path can only be applied after the vehicle is reserved.' }
    }
    return { ok: true }
  }

  if (gate === 'available_listed_only') {
    if (vehicle?.sold) return { ok: false, message: 'This work path is for listed stock only (vehicle is sold).' }
    if (vehicle?.reserved) {
      return {
        ok: false,
        message: 'This work path can only start while the vehicle is listed for sale (not reserved).',
      }
    }
    return { ok: true }
  }

  return { ok: true }
}
