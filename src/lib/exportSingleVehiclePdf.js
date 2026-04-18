import { jsPDF } from 'jspdf'

const HEADER = 'Smart Vehicle Inventory — vehicle summary'

function addLine(doc, label, value, y) {
  if (value === undefined || value === null || value === '') return y
  doc.setFont(undefined, 'bold')
  doc.text(`${label}:`, 14, y)
  doc.setFont(undefined, 'normal')
  const text = String(value)
  const lines = doc.splitTextToSize(text, 130)
  doc.text(lines, 58, y)
  return y + Math.max(7, lines.length * 5)
}

/** Client-side download of a one-vehicle PDF (not uploaded). */
export function downloadSingleVehiclePdf(vehicle) {
  if (!vehicle) return
  const doc = new jsPDF({ orientation: 'portrait' })
  let y = 16
  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(HEADER, 14, y)
  y += 10
  doc.setFontSize(9)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, y)
  y += 12
  doc.setTextColor(0, 0, 0)

  y = addLine(doc, 'Stock ID', vehicle.stock_id, y)
  y = addLine(doc, 'Plate', vehicle.plate_no, y)
  y = addLine(doc, 'VIN', vehicle.vin, y)
  y = addLine(doc, 'Brand / Model', [vehicle.brand, vehicle.model].filter(Boolean).join(' '), y)
  y = addLine(doc, 'Colour', vehicle.color, y)
  y = addLine(doc, 'Mileage', vehicle.mileage != null ? `${Number(vehicle.mileage).toLocaleString()} miles` : '', y)
  y = addLine(doc, 'Selling price', vehicle.selling_price != null && vehicle.selling_price !== '' ? `£${Number(vehicle.selling_price).toLocaleString()}` : '', y)
  y = addLine(doc, 'Status', vehicle.sold ? 'Sold' : vehicle.reserved ? 'Reserved' : 'Available', y)
  if (Array.isArray(vehicle.reservation_conditions) && vehicle.reservation_conditions.length > 0) {
    const parts = vehicle.reservation_conditions
      .map((x) => (typeof x === 'string' ? x : x?.text))
      .filter(Boolean)
    if (parts.length) y = addLine(doc, 'Reservation conditions', parts.map((p, i) => `${i + 1}. ${p}`).join('; '), y)
  }
  y = addLine(doc, 'Location', vehicle.location, y)
  if (vehicle.details) y = addLine(doc, 'Details', vehicle.details, y)

  const fname = `vehicle-${String(vehicle.stock_id || vehicle.id || 'export').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`
  doc.save(fname)
}
