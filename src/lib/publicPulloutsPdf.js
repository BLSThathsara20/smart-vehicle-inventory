/**
 * Public pullout schedule PDF: vehicles and prep-work progress — no customer/contact block.
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { ASAHI_BRAND_NAME, ASAHI_PRODUCT_TITLE } from '../constants/branding'
import {
  normalizeVehicleWorkflowInstances,
  workflowInstanceStepKey,
} from './sanityData'

function safe(s) {
  if (s == null || s === '') return '—'
  return String(s)
}

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(iso)
  }
}

function completedKeysSet(inst) {
  const m = new Set()
  for (const c of inst.completed_steps || []) {
    if (c?.step_key) m.add(c.step_key)
  }
  return m
}

export function summarizePulloutPrepPublic(vehicle) {
  const instances = normalizeVehicleWorkflowInstances(vehicle)
  if (!instances.length) return 'No prep paths'
  return instances
    .map((inst) => {
      const steps = inst.steps || []
      const dk = completedKeysSet(inst)
      let n = 0
      steps.forEach((_, i) => {
        if (dk.has(workflowInstanceStepKey(steps, i))) n += 1
      })
      const label = safe(inst.template_name) !== '—' ? inst.template_name : 'Prep path'
      const total = steps.length
      return total
        ? `${label}: ${safe(inst.status)} (${n}/${total} steps)`
        : `${label}: ${safe(inst.status)}`
    })
    .join(' · ')
}

function truncateMiddle(str, max) {
  const s = String(str ?? '')
  if (s.length <= max) return s
  const half = Math.floor((max - 1) / 2)
  return `${s.slice(0, half)}…${s.slice(s.length - (max - half - 1))}`
}

/** Checkbox-style mark — ASCII so built-in PDF fonts render reliably */
function subtaskDoneMark(done) {
  return done ? '[x]' : '[ ]'
}

/**
 * @param {{ kind?: string, body?: string, image_url?: string, image?: { asset?: { url?: string } } }} t
 */
function formatSubtaskPdfDescription(t) {
  if (!t || typeof t !== 'object') return '—'
  const imgUrl = t.image_url || t.image?.asset?.url
  if (t.kind === 'image') {
    const parts = ['Photo']
    const b = String(t.body || '').trim()
    if (b) parts.push(`— ${b}`)
    if (imgUrl) parts.push(`(${truncateMiddle(imgUrl, 72)})`)
    return parts.join(' ')
  }
  const body = String(t.body || '').trim()
  return body || '—'
}

/** Work path snapshots with flattened subtasks ([x]/[ ] per row); pullouts UI + PDF summary.
 * Steps with no checklist subtasks contribute one row showing step + assignee + [x]/[ ], with no filler task label.
 */
export function getPulloutPrepInstanceBlocks(vehicle) {
  const instances = normalizeVehicleWorkflowInstances(vehicle)
  if (!instances.length) return []

  return instances.map((inst, ii) => {
    const steps = inst.steps || []
    const dk = completedKeysSet(inst)
    const title = safe(inst.template_name) !== '—' ? inst.template_name : 'Prep path'
    const subtitleParts = [safe(inst.status)]
    if (inst.deadline_at) subtitleParts.push(`Deadline ${fmtDate(inst.deadline_at)}`)
    const subtitle = subtitleParts.join(' · ')
    const idRaw = inst.instance_id || inst.template_id || `prep-${ii}`

    const rows = []

    steps.forEach((step, si) => {
      const assignee = safe(step.assignee_name || step.assignee_uid)
      const stepLine = `${si + 1}. ${safe(step.title)}`
      const stepKey = workflowInstanceStepKey(steps, si)
      const stepCompleted = dk.has(stepKey)

      const subs = Array.isArray(step.subtasks) ? step.subtasks : []
      if (subs.length === 0) {
        rows.push({
          mark: subtaskDoneMark(stepCompleted),
          stepLine,
          assignee,
          task: '',
        })
        return
      }
      subs.forEach((t, ti) => {
        rows.push({
          mark: subtaskDoneMark(!!t.done),
          stepLine: ti === 0 ? stepLine : '',
          assignee,
          task: formatSubtaskPdfDescription(t),
        })
      })
    })

    if (rows.length === 0 && steps.length === 0) {
      rows.push({ mark: '—', stepLine: '(no steps)', assignee: '—', task: '—' })
    }

    return {
      id: safe(idRaw),
      title,
      subtitle,
      rows,
    }
  })
}

/** Multi-line prep column for PDF cover summary table. */
export function formatPulloutPrepSummaryForPdfCell(vehicle) {
  const blocks = getPulloutPrepInstanceBlocks(vehicle)
  if (!blocks.length) return 'No prep paths'

  const lines = []
  for (const b of blocks) {
    lines.push(`${b.title} — ${b.subtitle}`)
    for (const r of b.rows) {
      const stepBit = r.stepLine ? `${r.stepLine}: ` : '         '
      const taskRaw = String(r.task || '').trim()
      const taskShort = taskRaw && taskRaw !== '—' ? truncateMiddle(taskRaw, 110) : ''
      const prefix = ` ${r.mark} ${stepBit}${safe(r.assignee)}`
      lines.push(taskShort ? `${prefix} — ${taskShort}` : prefix)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
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
 * @param {unknown[]} vehicles
 */
export function buildPublicPulloutsSchedulePdf(vehicles) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 12
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const now = new Date()
  const year = now.getFullYear()
  const footerText = `© ${year} ${ASAHI_BRAND_NAME}. All rights reserved. Confidential — intended for authorised use only.`

  let y = margin

  doc.setFont(undefined, 'bold')
  doc.setFontSize(12)
  doc.setTextColor(24, 24, 27)
  doc.text(ASAHI_BRAND_NAME, margin, y)

  doc.setFont(undefined, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(82, 82, 91)
  doc.text(ASAHI_PRODUCT_TITLE, margin, y + 4.8)

  y += 9
  doc.setDrawColor(212, 212, 216)
  doc.setLineWidth(0.25)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  const list = Array.isArray(vehicles) ? vehicles : []
  const summaryBody = list.map((v) => [
    safe(v.stock_id != null ? `#${v.stock_id}` : ''),
    `${safe(v.brand)} ${safe(v.model)}`.trim() || '—',
    safe(v.plate_no),
    fmtDate(v.planned_collection_date),
    v.ready_pullout === true ? 'Yes' : 'No',
    formatPulloutPrepSummaryForPdfCell(v),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Stock', 'Vehicle', 'Plate', 'Collection', 'Ready', 'Prep paths & checklist']],
    body:
      summaryBody.length > 0
        ? summaryBody
        : [['—', 'No vehicles on pullout list', '—', '—', '—', '—']],
    margin: { left: margin, right: margin, bottom: margin + 22 },
    styles: {
      fontSize: 7.25,
      cellPadding: { top: 1.75, bottom: 1.75, left: 2, right: 2 },
      overflow: 'linebreak',
      valign: 'top',
      textColor: [39, 39, 42],
      lineColor: [228, 228, 231],
      lineWidth: 0.1,
      fontStyle: 'normal',
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      valign: 'middle',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      lineWidth: 0,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: 28 },
      2: { cellWidth: 18 },
      3: { cellWidth: 24 },
      4: { cellWidth: 12 },
      5: { cellWidth: pageW - 2 * margin - 95 },
    },
  })

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawPdfFooter(doc, margin, footerText, pageH)
  }

  const fname = `pullout-schedule-${now.toISOString().slice(0, 10)}.pdf`
  doc.save(fname)
  return doc
}
