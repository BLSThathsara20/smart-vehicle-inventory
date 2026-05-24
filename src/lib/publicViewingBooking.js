/**
 * Backend POST — HTTPS URL e.g. Cloud Function / other serverless (Sanity write with server-only token).
 */
export function getPublicViewingBookingPostUrl() {
	return String(import.meta.env.VITE_PUBLIC_VIEWING_BOOKING_URL || '').trim()
}

/**
 * Simple path — dealership inbox for pre-filled viewing requests via the customer's mail app (no backend).
 */
export function getPublicBookingMailtoRecipient() {
	return String(import.meta.env.VITE_PUBLIC_BOOKING_EMAIL || '').trim()
}

/** True if Submit can use HTTPS POST */
export function isPublicBookingPostConfigured() {
	return Boolean(getPublicViewingBookingPostUrl())
}

/** True if Submit can open a mail compose (mailto) */
export function isPublicBookingMailtoConfigured() {
	const e = getPublicBookingMailtoRecipient()
	return Boolean(e && e.includes('@'))
}

/** POST or mailto configured */
export function isPublicBookingSubmitConfigured() {
	return isPublicBookingPostConfigured() || isPublicBookingMailtoConfigured()
}

const MAX_MAILTO_BODY_CHARS = 1700

/**
 * Build viewing mailto payload (truncate body for client mail URL limits).
 * @param {object} p
 * @param {object} p.vehicle `{ brand?, model?, stock_id?, id }`
 */
export function buildPublicViewingBookingMailtoParts({ vehicle, scheduledAtIso, slotLabel, customer_name, customer_phone, customer_email, notes }) {
	const stockLabel = vehicle?.stock_id != null && vehicle.stock_id !== '' ? `#${vehicle.stock_id}` : null
	const title = [`Viewing request`, vehicle?.brand || '', vehicle?.model || '', stockLabel].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim()

	const whenDate = scheduledAtIso ? new Date(scheduledAtIso) : null
	const whenPretty =
		whenDate && !Number.isNaN(whenDate.getTime())
			? whenDate.toLocaleString('en-GB', {
					weekday: 'long',
					day: 'numeric',
					month: 'short',
					year: 'numeric',
					hour: 'numeric',
					minute: '2-digit',
			  })
			: String(slotLabel || '').trim()

	const vehicleLine = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ').trim()

	const paragraphs = [`Preferred date & time: ${whenPretty}`]
	const vehicleBits = []
	if (vehicleLine) vehicleBits.push(vehicleLine)
	if (stockLabel) vehicleBits.push(`Stock ${stockLabel}`)
	if (vehicleBits.length) paragraphs.push(`Vehicle: ${vehicleBits.join(' · ')}`)
	if (vehicle?.id) paragraphs.push(`Listing ID: ${vehicle.id}`)
	paragraphs.push(`Name: ${customer_name}`)
	paragraphs.push(`Phone: ${customer_phone}`)
	if (customer_email) paragraphs.push(`Email: ${customer_email}`)
	if (notes) paragraphs.push(`Notes: ${notes}`)

	let body = paragraphs.join('\n')
	if (body.length > MAX_MAILTO_BODY_CHARS) {
		body = `${body.slice(0, MAX_MAILTO_BODY_CHARS - 20)}\n…(truncated)`
	}

	return {
		to: getPublicBookingMailtoRecipient(),
		subject: title.slice(0, 240),
		body,
	}
}

/** Open default mail client without leaving the page (SPA-friendly). */
export function openPublicViewingBookingMailto(parts) {
	const { to, subject, body } = parts || {}
	if (!to || !to.includes('@')) {
		throw new Error('Booking email not configured.')
	}

	const href = `mailto:${to}?subject=${encodeURIComponent(subject || 'Viewing request')}&body=${encodeURIComponent(body || '')}`
	const a = document.createElement('a')
	a.href = href
	a.rel = 'noopener noreferrer'
	a.setAttribute('aria-hidden', 'true')
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}

/**
 * POST a public viewing request to Firebase Cloud Function (Sanity write uses server token).
 */
export async function submitPublicViewingBooking(payload) {
	const url = getPublicViewingBookingPostUrl()
	if (!url) {
		throw new Error('Public booking is not configured. Add VITE_PUBLIC_VIEWING_BOOKING_URL to your deployment.')
	}

	const res = await fetch(String(url).trim(), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'omit',
		body: JSON.stringify(payload),
	})

	let data = null
	try {
		data = await res.json()
	} catch {
		/* non-JSON */
	}

	if (!res.ok) {
		const msg = data?.error || data?.message || `Request failed (${res.status})`
		throw new Error(msg)
	}

	if (data && data.ok === false) {
		throw new Error(data.error || 'Booking failed')
	}

	return data ?? { ok: true }
}
