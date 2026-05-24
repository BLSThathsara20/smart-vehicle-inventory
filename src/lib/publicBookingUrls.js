/**
 * Customer-facing “book a viewing” share URL (public route, no login).
 * Respects Vite `base` (e.g. GitHub Pages subpath).
 */
export function buildPublicVehicleBookingPath(vehicleId) {
	const id = encodeURIComponent(String(vehicleId || '').trim())
	const base = import.meta.env.BASE_URL || '/'
	const normalized = base.endsWith('/') ? base : `${base}/`
	return `${normalized}book/vehicle/${id}`
}

export function buildPublicVehicleBookingAbsoluteUrl(vehicleId) {
	if (typeof window === 'undefined') {
		return buildPublicVehicleBookingPath(vehicleId)
	}
	return `${window.location.origin}${buildPublicVehicleBookingPath(vehicleId)}`
}
