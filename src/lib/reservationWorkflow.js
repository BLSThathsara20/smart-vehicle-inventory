/** Downstream milestones that imply fresh full service was satisfied (historical skips). */
export const LEGACY_STEPS_AFTER_FULL_SERVICE = [
  'pdi',
  'pdi_approved',
  'delivery',
  'ready',
  'ready_to_pickup',
  'delivered',
]

/**
 * Reservation progress for one vehicle: `updates` is step_key → row (from fetchWorkflowUpdates / by-step map).
 * When `customer` is true, the PDI line only counts as complete after manager approval (matches pickup page UX).
 */
export function isReservationStepComplete(
  stepKey,
  updates = {},
  vehicle,
  { customer = false } = {},
) {
  if (!stepKey) return false
  if (stepKey === 'reserved') return Boolean(vehicle?.reserved)
  if (customer && stepKey === 'pdi') return Boolean(updates.pdi_approved)
  if (updates[stepKey]) return true
  if (
    stepKey === 'full_service' &&
    LEGACY_STEPS_AFTER_FULL_SERVICE.some((k) => updates[k])
  ) {
    return true
  }
  return false
}

export const RESERVATION_STEPS = [
  { key: 'reserved', label: 'Customer reserved', icon: 'Lock' },
  {
    key: 'full_service',
    label: 'Fresh full service',
    icon: 'Wrench',
  },
  { key: 'pdi', label: 'Pre-delivery inspection', icon: 'ClipboardCheck' },
  { key: 'pdi_approved', label: 'PDI approved by manager', icon: 'ClipboardCheck', internalOnly: true },
  { key: 'delivery', label: 'Delivery scheduled', icon: 'Calendar' },
  {
    key: 'ready_to_pickup',
    label: 'Ready to pickup (manager approved)',
    icon: 'Package',
    internalOnly: true,
  },
  { key: 'delivered', label: 'Handover complete', icon: 'CheckCircle' },
]

/** Steps visible to customer (excludes internal-only) */
export const CUSTOMER_VISIBLE_STEPS = RESERVATION_STEPS.filter((s) => !s.internalOnly)
