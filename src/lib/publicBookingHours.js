/**
 * Retail opening rules for customer “book a viewing” (mirror in Cloud Function validation).
 *
 * Calendar `Date` uses browser local TZ; ISO sent to backend is validated in `PUBLIC_BOOKING_TIMEZONE`.
 */

/** @param {Date} date */
export function isPublicBookingDaySelectable(date) {
	if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return false
	// Mon–Sat vs Sun windows are in `publicBookingTimeSlotsForDay`; calendar allows each day’s slot strip.
	return true
}

/** @returns {{ id: string, label: string, hour: number, minute: number }[]} */
export function publicBookingTimeSlotsForDay(day) {
	if (!day || !isPublicBookingDaySelectable(day)) return []

	const dow = day.getDay()
	const fmtShort = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

	function labelFor(hour, minute) {
		const d = new Date(2000, 0, 1, hour, minute, 0, 0)
		return fmtShort.format(d)
	}

	const out = []

	if (dow >= 1 && dow <= 6) {
		// Mon–Sat: 10:00–18:30 start times every 30 min (last viewing block ends by 19:00)
		for (let mins = 10 * 60; mins <= 18 * 60 + 30; mins += 30) {
			const hour = Math.floor(mins / 60)
			const minute = mins % 60
			out.push({
				id: `wd-${mins}`,
				label: labelFor(hour, minute),
				hour,
				minute,
			})
		}
		return out
	}

	// Sunday: 12:30–15:00 starts every 30 min (closes 15:30)
	for (let mins = 12 * 60 + 30; mins <= 15 * 60; mins += 30) {
		const hour = Math.floor(mins / 60)
		const minute = mins % 60
		out.push({
			id: `sun-${mins}`,
			label: labelFor(hour, minute),
			hour,
			minute,
		})
	}
	return out
}
