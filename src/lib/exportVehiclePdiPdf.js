/**
 * Printable Pre-Delivery Inspection checklist (mirror of dealership paper form).
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import {
  PDI_CHECKS_COL1,
  PDI_CHECKS_COL2,
  PDI_MECHANIC_CHECKS,
  normalizePdiInspection,
  isPdiFinalized,
} from './pdiInspectionModel.js'

function yn(v) {
  return v ? 'Yes' : 'No'
}

/**
 * @param {Partial<{ plate_no?: string, stock_id?: string, brand?: string, model?: string }>} vehicle
 * @param {unknown} inspection
 */
export function buildVehiclePdiPdf(vehicle = {}, inspection) {
  const pdi = normalizePdiInspection(inspection)
  const brandLine = import.meta.env.VITE_PDI_BRAND_LINE || 'ASAHIMOTORS UK GROUP'
  const stock = vehicle?.stock_id ? `#${vehicle.stock_id}` : ''
  const title = `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim()

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 12
  let y = margin

  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(brandLine, margin, y)
  y += 7
  doc.setFontSize(11)
  doc.text('Pre-Delivery Inspection Checklist', margin, y)
  y += 6
  doc.setFontSize(8)
  doc.setFont(undefined, 'normal')
  doc.text(`Stock: ${stock || '—'}   Record: ${title || 'Vehicle'}`.trim(), margin, y)
  y += 5

  const h = pdi.header || {}
  autoTable(doc, {
    startY: y,
    styles: { fontSize: 7.5, cellPadding: 1 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: pageW - margin * 2 - 38 },
    },
    body: [
      ['REG NUMBER', String(h.reg_number || '—')],
      ['VIN NUMBER', String(h.vin_number || '—')],
      ['MILEAGE', String(h.mileage || '—')],
      ['DATE', String(h.date_iso || '—')],
      ['MAKE & MODEL', String(h.make_model || '—')],
      ['CUSTOMER', String(h.customer || '—')],
      ['ASSESSOR', String(h.assessor || '—')],
      ['SIGNATURE', String(h.signature || '—')],
    ],
  })

  let tableEnd = doc.lastAutoTable?.finalY
  y = (typeof tableEnd === 'number' ? tableEnd : y) + 6

  doc.setFont(undefined, 'bold')
  doc.setFontSize(9)
  doc.text('Main inspection checklist', margin, y)
  y += 4

  const rows = []
  const maxRows = Math.max(PDI_CHECKS_COL1.length, PDI_CHECKS_COL2.length)
  for (let i = 0; i < maxRows; i++) {
    const left = PDI_CHECKS_COL1[i]
    const right = PDI_CHECKS_COL2[i]
    const leftLabel = left ? left.label : ''
    const rightLabel = right ? right.label : ''
    const lk = left ? !!pdi.checks_main[left.key] : false
    const rk = right ? !!pdi.checks_main[right.key] : false
    rows.push([leftLabel, left ? yn(lk) : '', rightLabel, right ? yn(rk) : ''])
  }

  autoTable(doc, {
    startY: y,
    head: [['Item (left)', 'OK', 'Item (right)', 'OK']],
    body: rows,
    styles: { fontSize: 7, cellPadding: 0.8 },
    headStyles: { fillColor: [39, 39, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 63 },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 63 },
      3: { cellWidth: 16, halign: 'center' },
    },
  })
  tableEnd = doc.lastAutoTable?.finalY
  y = (typeof tableEnd === 'number' ? tableEnd : y) + 6

  doc.setFont(undefined, 'bold')
  doc.text('Tyre tread', margin, y)
  y += 4
  const tyres = pdi.tyre_tread || {}
  autoTable(doc, {
    startY: y,
    body: [
      [
        'FR',
        yn(!!tyres.fr),
        'FL',
        yn(!!tyres.fl),
        'RR',
        yn(!!tyres.rr),
        'RL',
        yn(!!tyres.rl),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 1 },
  })
  tableEnd = doc.lastAutoTable?.finalY
  y = (typeof tableEnd === 'number' ? tableEnd : y) + 6

  doc.setFont(undefined, 'bold')
  doc.text('For mechanic / service tech', margin, y)
  y += 4
  autoTable(doc, {
    startY: y,
    body: PDI_MECHANIC_CHECKS.map((m) => [m.label, yn(!!pdi.checks_mechanic[m.key])]),
    styles: { fontSize: 7, cellPadding: 0.8 },
    columnStyles: {
      0: { cellWidth: pageW - margin * 2 - 20 },
      1: { cellWidth: 20, halign: 'center' },
    },
  })
  tableEnd = doc.lastAutoTable?.finalY
  y = (typeof tableEnd === 'number' ? tableEnd : y) + 6

  doc.setFont(undefined, 'bold')
  doc.text('Damages including locations', margin, y)
  y += 4
  doc.setFont(undefined, 'normal')
  const damages = (pdi.damages || '').trim() || '—'
  const split = doc.splitTextToSize(damages, pageW - margin * 2)
  doc.setFontSize(8)
  doc.text(split, margin, y)
  y += Math.min(28, split.length * 3.6) + 6

  doc.setFont(undefined, 'bold')
  doc.text('Approved by Managing Director (signature / name)', margin, y)
  y += 5
  doc.setFont(undefined, 'normal')
  doc.text(String(h.md_signature || '—'), margin, y)
  y += 8

  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  if (pdi.finalized_at) {
    doc.text(
      `PDI finalized: ${new Date(pdi.finalized_at).toLocaleString()}${pdi.finalized_by_name ? ` · ${pdi.finalized_by_name}` : ''}`,
      margin,
      y
    )
  } else {
    doc.text('Draft export — not marked complete in app', margin, y)
  }

  return doc
}

export function downloadVehiclePdiPdf(vehicle, inspection, filenameBase = 'pdi') {
  if (!isPdiFinalized(inspection)) {
    throw new Error('PDI must be completed before exporting the PDF.')
  }
  const doc = buildVehiclePdiPdf(vehicle, inspection)
  const safe = String(filenameBase).replace(/[^\w.-]+/g, '_')
  doc.save(`${safe}.pdf`)
}
