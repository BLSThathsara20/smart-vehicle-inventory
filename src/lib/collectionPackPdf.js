/**
 * Printable collection / pulout report: vehicle, customer, collection date, work paths, steps & checklists.
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
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

function fmtDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return String(iso)
  }
}

/**
 * @param {import('../lib/sanityData').NormalizedVehicle-ish} vehicle
 * @param {{ nameByUid: Record<string, string> }} ctx
 */
export function buildCollectionPackPdf(vehicle, ctx = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const nameByUid = ctx.nameByUid || {}
  const margin = 14
  let y = 14

  const now = new Date()
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text('Collection (pulout) report', margin, y)
  y += 9
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)
  doc.text(`Generated ${fmtDateTime(now.toISOString())}`, margin, y)
  y += 10

  const stock = vehicle.stock_id != null ? `#${vehicle.stock_id}` : '—'
  const titleLine = `${safe(vehicle.brand)} ${safe(vehicle.model)}`.trim() || 'Vehicle'
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text(titleLine, margin, y)
  y += 7
  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  const ident = [
    `Stock: ${stock}`,
    `Plate: ${safe(vehicle.plate_no)}`,
    vehicle.vin ? `VIN: ${safe(vehicle.vin)}` : null,
  ]
    .filter(Boolean)
    .join('   ·   ')
  doc.text(ident, margin, y)
  y += 12

  doc.setFont(undefined, 'bold')
  doc.text('Planned collection (pulout)', margin, y)
  y += 6
  doc.setFont(undefined, 'normal')
  doc.setFontSize(11)
  const pulout = vehicle.planned_collection_date
    ? fmtDate(vehicle.planned_collection_date)
    : 'Not set — add in vehicle edit / reservation workflow'
  doc.text(pulout, margin, y)
  y += 10

  doc.setFont(undefined, 'bold')
  doc.text('Customer', margin, y)
  y += 6
  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  const custLines = [
    safe(vehicle.customer_name || vehicle.buyers_name),
    safe(vehicle.customer_email),
    safe(vehicle.customer_phone),
    vehicle.deposit_amount != null && vehicle.deposit_amount !== ''
      ? `Deposit £${Number(vehicle.deposit_amount).toLocaleString()}`
      : null,
    vehicle.reserved_date ? `Reserved: ${fmtDate(vehicle.reserved_date)}` : null,
  ].filter((x) => x && x !== '—')

  custLines.forEach((line) => {
    doc.text(line, margin, y)
    y += 5
  })
  y += 4

  const instances = normalizeVehicleWorkflowInstances(vehicle)
  if (!instances.length) {
    doc.setFont(undefined, 'italic')
    doc.setFontSize(10)
    doc.text('No work paths assigned yet.', margin, y)
    doc.save(
      `collection-${stock.replace(/[^\w.-]+/g, '') || vehicle.id}-${now.toISOString().slice(0, 10)}.pdf`,
    )

    return doc
  }

  instances.forEach((inst, ii) => {
    if (y > 245) {
      doc.addPage()
      y = 14
    }
    doc.setFont(undefined, 'bold')
    doc.setFontSize(11)
    doc.text(`Prep path ${ii + 1}: ${safe(inst.template_name) || 'Work path'}`, margin, y)
    y += 5
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    const meta = [`Status: ${safe(inst.status)}`]
    if (inst.deadline_at) meta.push(`Deadline: ${fmtDateTime(inst.deadline_at)}`)
    if (inst.finished_at) meta.push(`Finished: ${fmtDateTime(inst.finished_at)}`)
    doc.text(meta.join('   ·   '), margin, y)
    y += 8

    const steps = inst.steps || []
    const completed = inst.completed_steps || []
    const doneByKey = new Map(completed.map((c) => [c.step_key, c]))

    const body = []
    steps.forEach((step, si) => {
      const sk = workflowInstanceStepKey(steps, si)
      const row = doneByKey.get(sk)
      const assignee = safe(step.assignee_name || step.assignee_uid)
      let status = 'Pending'
      let when = '—'
      let who = '—'
      if (row) {
        status = 'Done'
        when = fmtDateTime(row.completed_at)
        who = nameByUid[row.completed_by_uid] || safe(row.completed_by_uid)
      } else if (inst.status === 'active') {
        const cur = Number(inst.current_step_index) || 0
        if (!inst.allow_step_overlap && si === cur) status = 'In progress'
        if (inst.allow_step_overlap) status = 'Open'
      }

      const subs = step.subtasks || []
      let subText = ''
      if (subs.length) {
        subText = subs
          .map((t) => {
            const label = t.kind === 'image' ? '[Photo]' : '[Text]'
            const bodyText = (t.body || (t.image_url ? 'Image' : '')).trim() || '—'
            const mark = t.done ? '✓' : '○'
            return `${mark} ${label} ${bodyText}`
          })
          .join('\n')
      } else {
        subText = '—'
      }

      body.push([
        String(si + 1),
        safe(step.title),
        assignee,
        status,
        when,
        who,
        subText,
      ])
    })

    autoTable(doc, {
      startY: y,
      head: [['#', 'Step', 'Assigned to', 'Status', 'Completed', 'Completed by', 'Checklist / subtasks']],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [245, 158, 11], textColor: [24, 24, 27] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 32 },
        2: { cellWidth: 28 },
        3: { cellWidth: 18 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 46 },
      },
    })
    y = doc.lastAutoTable.finalY + 10
  })

  const fname = `pulout-${String(vehicle.stock_id || vehicle.id || 'vehicle').replace(/[^\w.-]+/g, '_')}-${now.toISOString().slice(0, 10)}.pdf`

  doc.save(fname)
  return doc
}
