import { jsPDF } from 'jspdf'
import { ASAHI_LOGO_URL, ASAHI_BRAND_NAME, ASAHI_PRODUCT_TITLE } from '../constants/branding'

const ORANGE = [245, 158, 11]
const ORANGE_DARK = [180, 83, 9]
const TEXT = [39, 39, 42]
const MUTED = [113, 113, 122]
const HEADER_H_MM = 34
const MARGIN = 14
const PAGE_W = 210

function collectFeatureLabels(features) {
  if (!features || typeof features !== 'object') return []
  return Object.entries(features)
    .map(([k, v]) => {
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (v === true) return k.replace(/_/g, ' ')
      return null
    })
    .filter(Boolean)
}

async function fetchLogoForPdf(url) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const mime = blob.type || 'image/png'
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
    const fmt = mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : 'PNG'
    const dims = await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 120, h: 40 })
      img.src = dataUrl
    })
    return { dataUrl, fmt, w: dims.w, h: dims.h }
  } catch {
    return null
  }
}

function drawHeader(doc, logo) {
  doc.setFillColor(...ORANGE)
  doc.rect(0, 0, PAGE_W, HEADER_H_MM, 'F')

  let textLeft = MARGIN
  const logoMaxH = 22
  const logoMaxW = 55

  if (logo) {
    const ratio = logo.w / logo.h
    let h = logoMaxH
    let w = ratio * h
    if (w > logoMaxW) {
      w = logoMaxW
      h = w / ratio
    }
    const x = MARGIN
    const y = (HEADER_H_MM - h) / 2
    try {
      doc.addImage(logo.dataUrl, logo.fmt, x, y, w, h, undefined, 'FAST')
      textLeft = MARGIN + w + 6
    } catch {
      textLeft = MARGIN
    }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(ASAHI_BRAND_NAME, textLeft, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(ASAHI_PRODUCT_TITLE, textLeft, 19)
  doc.setFontSize(8.5)
  doc.setTextColor(255, 255, 255)
  doc.text('Vehicle summary', textLeft, 25)

  doc.setTextColor(...TEXT)
}

function addFieldRow(doc, label, value, y) {
  if (value === undefined || value === null || value === '') return y
  doc.setDrawColor(...ORANGE)
  doc.setLineWidth(0.35)
  doc.line(MARGIN, y - 0.5, MARGIN + 1.2, y - 0.5)
  doc.line(MARGIN, y - 0.5, MARGIN, y + 4.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(`${label}`, MARGIN + 3, y + 3.2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  const text = String(value)
  const lines = doc.splitTextToSize(text, PAGE_W - MARGIN - 58)
  doc.text(lines, 58, y + 3.2)
  return y + Math.max(8, lines.length * 4.2 + 2)
}

function addSectionTitle(doc, title, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...ORANGE_DARK)
  doc.text(title, MARGIN, y)
  doc.setDrawColor(...ORANGE)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + 1.5, PAGE_W - MARGIN, y + 1.5)
  doc.setTextColor(...TEXT)
  return y + 8
}

/** Client-side download; loads logo from hosted URL (CORS permitting). */
export async function downloadSingleVehiclePdf(vehicle) {
  if (!vehicle) return

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const logo = await fetchLogoForPdf(ASAHI_LOGO_URL)
  drawHeader(doc, logo)

  let y = HEADER_H_MM + 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, y)
  y += 10

  y = addSectionTitle(doc, 'Vehicle details', y)

  y = addFieldRow(doc, 'Stock ID', vehicle.stock_id, y)
  y = addFieldRow(doc, 'Plate', vehicle.plate_no, y)
  y = addFieldRow(doc, 'VIN', vehicle.vin, y)
  y = addFieldRow(doc, 'Brand / model', [vehicle.brand, vehicle.model].filter(Boolean).join(' '), y)
  y = addFieldRow(doc, 'Colour', vehicle.color, y)
  y = addFieldRow(
    doc,
    'Mileage',
    vehicle.mileage != null ? `${Number(vehicle.mileage).toLocaleString()} miles` : '',
    y
  )
  y = addFieldRow(
    doc,
    'Selling price',
    vehicle.selling_price != null && vehicle.selling_price !== ''
      ? `£${Number(vehicle.selling_price).toLocaleString()}`
      : '',
    y
  )
  y = addFieldRow(doc, 'Status', vehicle.sold ? 'Sold' : vehicle.reserved ? 'Reserved' : 'Available', y)
  if (Array.isArray(vehicle.reservation_conditions) && vehicle.reservation_conditions.length > 0) {
    const parts = vehicle.reservation_conditions
      .map((x) => (typeof x === 'string' ? x : x?.text))
      .filter(Boolean)
    if (parts.length) {
      y = addFieldRow(doc, 'Reservation conditions', parts.map((p, i) => `${i + 1}. ${p}`).join('  '), y)
    }
  }
  y = addFieldRow(doc, 'Location', vehicle.location, y)
  if (vehicle.details) y = addFieldRow(doc, 'Details', vehicle.details, y)

  const featureLabels = collectFeatureLabels(vehicle.features)
  if (featureLabels.length > 0) {
    y += 4
    if (y > 250) {
      doc.addPage()
      y = 20
    }
    y = addSectionTitle(doc, 'Features', y)
    const innerW = PAGE_W - 2 * MARGIN - 14
    let featH = 6
    for (const f of featureLabels) {
      const lines = doc.splitTextToSize(f, innerW)
      featH += Math.max(5.5, lines.length * 4.5)
    }
    doc.setFillColor(255, 251, 235)
    doc.setDrawColor(...ORANGE)
    doc.setLineWidth(0.2)
    doc.rect(MARGIN, y - 2, PAGE_W - 2 * MARGIN, featH, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT)
    let fy = y + 4
    for (const f of featureLabels) {
      doc.setTextColor(...ORANGE_DARK)
      doc.text('•', MARGIN + 4, fy)
      doc.setTextColor(...TEXT)
      const lines = doc.splitTextToSize(f, innerW)
      doc.text(lines, MARGIN + 8, fy)
      fy += Math.max(5.5, lines.length * 4.5)
    }
    y = y - 2 + featH + 6
  }

  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(`${ASAHI_BRAND_NAME} · ${ASAHI_PRODUCT_TITLE}`, MARGIN, 287)

  const fname = `vehicle-${String(vehicle.stock_id || vehicle.id || 'export').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`
  doc.save(fname)
}
