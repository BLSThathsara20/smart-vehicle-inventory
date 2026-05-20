/**
 * Public pullout schedule PDF: vehicles and prep-work progress — no customer/contact block.
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

function checklistSummary(step) {
  const subs = step.subtasks || []
  if (!subs.length) return '—'
  const done = subs.filter((t) => t.done).length
  return `${done}/${subs.length}`
}

/**
 * @param {unknown[]} vehicles
 */
export function buildPublicPulloutsSchedulePdf(vehicles) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 14

  const now = new Date()
  doc.setFontSize(15)
  doc.setFont(undefined, 'bold')
  doc.text('Scheduled collections (pulout)', margin, y)
  y += 8
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)
  doc.text(
    `Listing reserved vehicles with a planned collection date. No customer details. Generated ${fmtDateTime(now.toISOString())}`,
    margin,
    y,
    { maxWidth: 180 },
  )
  y += 12

  const list = Array.isArray(vehicles) ? vehicles : []
  const summaryBody = list.map((v) => [
    safe(v.stock_id != null ? `#${v.stock_id}` : ''),
    `${safe(v.brand)} ${safe(v.model)}`.trim() || '—',
    safe(v.plate_no),
    fmtDate(v.planned_collection_date),
    v.ready_pullout === true ? 'Yes' : 'No',
    summarizePulloutPrepPublic(v),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Stock', 'Vehicle', 'Plate', 'Collection date', 'Ready pulout', 'Prep paths (summary)']],
    body:
      summaryBody.length > 0
        ? summaryBody
        : [['—', 'No scheduled pullouts', '—', '—', '—', '—']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [245, 158, 11], textColor: [24, 24, 27] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 36 },
      2: { cellWidth: 22 },
      3: { cellWidth: 28 },
      4: { cellWidth: 18 },
      5: { cellWidth: 52 },
    },
  })
  y = doc.lastAutoTable.finalY + 12

  for (const vehicle of list) {
    doc.addPage()
    y = 14
    const stock = vehicle.stock_id != null ? `#${vehicle.stock_id}` : '—'
    const title =
      `${safe(vehicle.brand)} ${safe(vehicle.model)}`.trim() || 'Vehicle'
    doc.setFont(undefined, 'bold')
    doc.setFontSize(12)
    doc.text(`${title}`, margin, y)
    y += 7
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      [
        `Stock: ${stock}`,
        `Plate: ${safe(vehicle.plate_no)}`,
        vehicle.vin ? `VIN: ${safe(vehicle.vin)}` : null,
      ]
        .filter(Boolean)
        .join('   ·   '),
      margin,
      y,
      { maxWidth: 182 },
    )
    y += 8
    doc.setFont(undefined, 'bold')
    doc.text('Planned collection', margin, y)
    y += 5
    doc.setFont(undefined, 'normal')
    doc.text(fmtDate(vehicle.planned_collection_date), margin, y)
    y += 6
    doc.text(`Ready for pulout: ${vehicle.ready_pullout === true ? 'Yes' : 'No'}`, margin, y)
    y += 10

    const instances = normalizeVehicleWorkflowInstances(vehicle)
    if (!instances.length) {
      doc.setFont(undefined, 'italic')
      doc.text('No prep paths assigned for this vehicle.', margin, y)
      y += 8
      continue
    }

    instances.forEach((inst, ii) => {
      if (y > 258) {
        doc.addPage()
        y = 14
      }
      doc.setFont(undefined, 'bold')
      doc.setFontSize(10)
      doc.text(
        `Prep path ${ii + 1}: ${safe(inst.template_name) !== '—' ? inst.template_name : 'Work path'}`,
        margin,
        y,
      )
      y += 5
      doc.setFont(undefined, 'normal')
      doc.setFontSize(8)
      const meta = [`Status: ${safe(inst.status)}`]
      if (inst.deadline_at) meta.push(`Deadline: ${fmtDateTime(inst.deadline_at)}`)
      if (inst.finished_at) meta.push(`Finished: ${fmtDateTime(inst.finished_at)}`)
      doc.text(meta.join('   ·   '), margin, y)
      y += 8

      const steps = inst.steps || []
      const doneByKey = new Map((inst.completed_steps || []).map((c) => [c.step_key, c]))
      const body = []
      steps.forEach((step, si) => {
        const sk = workflowInstanceStepKey(steps, si)
        const row = doneByKey.get(sk)
        let status = 'Pending'
        let completedAt = '—'
        if (row) {
          status = 'Done'
          completedAt = fmtDateTime(row.completed_at)
        } else if (inst.status === 'active') {
          const cur = Number(inst.current_step_index) || 0
          if (!inst.allow_step_overlap && si === cur) status = 'In progress'
          if (inst.allow_step_overlap) status = 'Open'
        }
        body.push([
          String(si + 1),
          safe(step.title),
          status,
          completedAt,
          checklistSummary(step),
        ])
      })

      autoTable(doc, {
        startY: y,
        head: [['#', 'Step', 'Status', 'Completed at', 'Checklist']],
        body,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [63, 63, 70], textColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 58 },
          2: { cellWidth: 22 },
          3: { cellWidth: 32 },
          4: { cellWidth: 20 },
        },
      })
      y = doc.lastAutoTable.finalY + 10
    })
  }

  const fname = `pullout-schedule-${now.toISOString().slice(0, 10)}.pdf`
  doc.save(fname)
  return doc
}
