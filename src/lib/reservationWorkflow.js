export const RESERVATION_STEPS = [
  { key: 'reserved', label: 'Customer reserved', icon: 'Lock' },
  { key: 'pdi', label: 'Pre-delivery inspection', icon: 'ClipboardCheck' },
  { key: 'pdi_approved', label: 'PDI approved by manager', icon: 'ClipboardCheck', internalOnly: true },
  { key: 'delivery', label: 'Delivery scheduled', icon: 'Calendar' },
  { key: 'ready', label: 'Ready for pullout', icon: 'Package' },
  { key: 'ready_to_pickup', label: 'Ready to pickup (manager approved)', icon: 'Package', internalOnly: true },
  { key: 'delivered', label: 'Handover complete', icon: 'CheckCircle' },
]

/** Steps visible to customer (excludes internal-only) */
export const CUSTOMER_VISIBLE_STEPS = RESERVATION_STEPS.filter((s) => !s.internalOnly)
