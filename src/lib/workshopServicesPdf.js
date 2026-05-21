/**
 * Workshop services list PDF — operational fields only (no customer name / phone / email / notes).
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { ASAHI_BRAND_NAME, ASAHI_PRODUCT_TITLE } from '../constants/branding'

function fmtDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return String(iso)
  }
}

function safeDash(s) {
  if (s == null || s === '') return '—'
  return String(s)
}

function uidToLabel(uid, profileMap) {
  if (!uid || !profileMap?.size) return '—'
  const p = profileMap.get(uid)
  if (!p) return String(uid).slice(0, 10) + '…'
  return String(p.display_name || p.email || uid).trim() || '—'
}

function drawPdfFooter(doc, margin, footerText, pageHeight) {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFontSize(7)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(113, 113, 122)
  const lines = doc.splitTextToSize(footerText, pageWidth - margin * 2)
  const lineH = 3.25
  const baseY = pageHeight - margin - (lines.length - 1) * lineH - 3
  doc.text(lines, margin, baseY)
  doc.setTextColor(24, 24, 27)
}

/**
 * @param {Array<Record<string, unknown>>} rows — from fetchWorkshopServicesForPdfExport + profile enrichment optional
 * @param {unknown[]} [profiles] — fetchAllUserProfiles rows for mechanic/sales labels
 */
export function buildWorkshopServicesListPdf(rows, profiles) {
  /** @type {Map<string, { display_name?: string, email?: string }>} */
  const profileMap = new Map()
  for (const p of profiles || []) {
    const uid = p?.firebase_uid || p?.user_id
    if (uid) profileMap.set(uid, p)
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 12
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const now = new Date()
  const year = now.getFullYear()
  const footerText = `© ${year} ${ASAHI_BRAND_NAME}. All rights reserved. Operational export — excludes customer-identifying fields. Confidential — authorised use only.`

  let y = margin
  doc.setFont(undefined, 'bold')
  doc.setFontSize(12)
  doc.setTextColor(24, 24, 27)
  doc.text(ASAHI_BRAND_NAME, margin, y)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(82, 82, 91)
  doc.text(ASAHI_PRODUCT_TITLE, margin, y + 4.8)
  doc.text('Workshop schedule (all statuses)', margin, y + 8.8)
  y += 13
  doc.setDrawColor(212, 212, 216)
  doc.setLineWidth(0.25)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  const list = Array.isArray(rows) ? rows : []
  const summaryBody = list.map((r) => {
    const mechanicUid = String(r.mechanic_firebase_uid || '')
    const salesUid = String(r.sales_firebase_uid || '')
    const mechanic = uidToLabel(mechanicUid, profileMap)
    const sales = uidToLabel(salesUid, profileMap)
    const stockHint =
      r.inventory_stock_id && String(r.inventory_stock_id).trim()
        ? `#${String(r.inventory_stock_id).trim()}`
        : r.inventory_vehicle_ref
          ? 'Linked'
          : '—'
    const inventoryCol = r.is_asahi_customer ? `Yes · ${stockHint}` : 'No'
    const svcPriceNum = Number(r.service_price)
    const priceCell =
      r.service_price != null && svcPriceNum >= 0 && Number.isFinite(svcPriceNum)
        ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(svcPriceNum)
        : '—'
    const vehicleLabel =
      [r.vehicle_make, r.vehicle_model]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' ') || '—'
    const statusEnd =
      r.status === 'completed' && r.completed_at
        ? ` · ${fmtDateTime(r.completed_at)}`
        : r.status === 'cancelled' && r.cancelled_at
          ? ` · ${fmtDateTime(r.cancelled_at)}`
          : ''
    return [
      fmtDateTime(r.scheduled_at),
      vehicleLabel || '—',
      safeDash(r.plate),
      String(r.duration_minutes ?? '—'),
      priceCell,
      safeDash(r.location),
      String(r.status || '—').toUpperCase() + statusEnd,
      inventoryCol,
      mechanic,
      sales,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [
      [
        'Scheduled',
        'Vehicle',
        'Plate',
        'Mins',
        '£',
        'Location',
        'Status',
        'Inventory cust.',
        'Mechanic',
        'Sales',
      ],
    ],
    body:
      summaryBody.length > 0
        ? summaryBody
        : [['—', 'No bookings', '—', '—', '—', '—', '—', '—', '—', '—']],
    margin: { left: margin, right: margin, bottom: margin + 22 },
    styles: {
      fontSize: 6.5,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
      overflow: 'linebreak',
      valign: 'top',
      textColor: [39, 39, 42],
      lineColor: [228, 228, 231],
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      valign: 'middle',
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 16 },
      2: { cellWidth: 13 },
      3: { cellWidth: 8 },
      4: { cellWidth: 13 },
      5: { cellWidth: 12 },
      6: { cellWidth: 20 },
      7: { cellWidth: 16 },
      8: { cellWidth: 18 },
      9: { cellWidth: 17 },
    },
  })

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawPdfFooter(doc, margin, footerText, pageH)
  }

  doc.save(`workshop-services-${now.toISOString().slice(0, 10)}.pdf`)
}
