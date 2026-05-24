/**
 * POST a public viewing request to Firebase Cloud Function (Sanity write uses server token).
 */
export async function submitPublicViewingBooking(payload) {
	const url = import.meta.env.VITE_PUBLIC_VIEWING_BOOKING_URL
	if (!url || !String(url).trim()) {
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
