import { supabase } from './supabase'

export async function fetchAppNotifications() {
  const today = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const notifications = []

  const { data: reservedVehicles } = await supabase
    .from('vehicles')
    .select('id, stock_id, brand, model, planned_collection_date, mot_expiry_date, reserved, sold')
    .eq('reserved', true)
    .eq('sold', false)

  const { data: allForMot } = await supabase
    .from('vehicles')
    .select('id, stock_id, brand, model, mot_expiry_date')
    .not('mot_expiry_date', 'is', null)
    .eq('sold', false)

  const vehicles = reservedVehicles || []
  const reservedIds = vehicles.map((v) => v.id)

  let pdiApprovedStatus = {}
  if (reservedIds.length > 0) {
    const { data: pdiApproved } = await supabase
      .from('reservation_workflow_updates')
      .select('vehicle_id')
      .in('vehicle_id', reservedIds)
      .eq('step_key', 'pdi_approved')
    ;(pdiApproved || []).forEach((u) => { pdiApprovedStatus[u.vehicle_id] = true })
  }

  for (const v of vehicles || []) {
    const collectionDate = v.planned_collection_date
    const motExpiry = v.mot_expiry_date
    const pdiDone = pdiApprovedStatus[v.id]

    if (collectionDate) {
      if (collectionDate === today) {
        notifications.push({
          id: `delivery-today-${v.id}`,
          vehicleId: v.id,
          type: 'delivery_today',
          title: 'Delivery today',
          message: `#${v.stock_id} ${v.brand} ${v.model} — Collection scheduled for today`,
          dueDate: collectionDate,
          severity: 'high',
        })
      } else if (collectionDate > today && collectionDate <= in7Days) {
        const days = Math.ceil((new Date(collectionDate) - new Date()) / (24 * 60 * 60 * 1000))
        notifications.push({
          id: `delivery-soon-${v.id}`,
          vehicleId: v.id,
          type: 'delivery_soon',
          title: `Delivery in ${days} day${days !== 1 ? 's' : ''}`,
          message: `#${v.stock_id} ${v.brand} ${v.model} — Collection on ${new Date(collectionDate).toLocaleDateString()}`,
          dueDate: collectionDate,
          severity: 'medium',
        })
      }

      if (!pdiDone && collectionDate >= today && collectionDate <= in7Days) {
        notifications.push({
          id: `pdi-due-${v.id}`,
          vehicleId: v.id,
          type: 'pdi_due',
          title: 'Pre-delivery inspection due',
          message: `#${v.stock_id} ${v.brand} ${v.model} — PDI must be completed before delivery`,
          dueDate: collectionDate,
          severity: 'high',
        })
      }
    }

  }

  for (const v of allForMot || []) {
    const motExpiry = v.mot_expiry_date
    if (!motExpiry) continue
    const days = Math.ceil((new Date(motExpiry) - new Date()) / (24 * 60 * 60 * 1000))
    if (days <= 0) {
      notifications.push({
        id: `mot-expiry-${v.id}`,
        vehicleId: v.id,
        type: 'mot_expiry',
        title: 'MOT expired',
        message: `#${v.stock_id} ${v.brand} ${v.model} — MOT expired on ${new Date(motExpiry).toLocaleDateString()}`,
        dueDate: motExpiry,
        severity: 'high',
      })
    } else if (motExpiry <= in30Days) {
      notifications.push({
        id: `mot-expiry-${v.id}`,
        vehicleId: v.id,
        type: 'mot_expiry',
        title: `MOT expires in ${days} day${days !== 1 ? 's' : ''}`,
        message: `#${v.stock_id} ${v.brand} ${v.model} — MOT expiry: ${new Date(motExpiry).toLocaleDateString()}`,
        dueDate: motExpiry,
        severity: days <= 7 ? 'high' : 'medium',
      })
    }
  }

  notifications.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
  return notifications
}
