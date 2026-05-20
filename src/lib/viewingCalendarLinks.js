/** Client-side calendar helpers (no Google OAuth). Staff can add to their calendar; .ics can be emailed to the customer. */

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Google Calendar template expects UTC dates as YYYYMMDDTHHmmssZ */
export function toGoogleCalendarUtcRange(isoStart, durationMinutes = 60) {
  const start = new Date(isoStart)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + (durationMinutes || 60) * 60 * 1000)
  const fmt = (d) =>
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  return { start: fmt(start), end: fmt(end) }
}

export function buildViewingGoogleCalendarUrl({
  title,
  details,
  location,
  isoStart,
  durationMinutes = 60,
}) {
  const range = toGoogleCalendarUtcRange(isoStart, durationMinutes)
  if (!range) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Vehicle viewing',
    dates: `${range.start}/${range.end}`,
    details: details || '',
    location: location || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function escapeIcsText(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function buildViewingIcsContent({
  uid,
  title,
  description,
  location,
  isoStart,
  durationMinutes = 60,
  attendeeEmail,
}) {
  const start = new Date(isoStart)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + (durationMinutes || 60) * 60 * 1000)
  const stamp = new Date()
  const fmt = (d) =>
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Car Inventory//Viewing//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid || `${isoStart}-viewing`)}`,
    `DTSTAMP:${fmt(stamp)}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
  ]
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)
  if (attendeeEmail && String(attendeeEmail).includes('@')) {
    lines.push(`ATTENDEE;CN=Customer;RSVP=TRUE:mailto:${String(attendeeEmail).trim()}`)
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcsFile(filename, icsBody) {
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
