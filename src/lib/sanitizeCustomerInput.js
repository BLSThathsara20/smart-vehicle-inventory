import DOMPurify from 'dompurify'

/**
 * Strip HTML/markup and control characters for customer-supplied text before send or display.
 */
export function sanitizeCustomerPlainText(input, maxLen = 2000) {
	if (input == null) return ''
	const raw = String(input).slice(0, maxLen + 200)
	const cleaned = DOMPurify.sanitize(raw, {
		ALLOWED_TAGS: [],
		KEEP_CONTENT: true,
	})
	return cleaned
		.normalize('NFKC')
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
		.trim()
		.slice(0, maxLen)
}

export function sanitizeCustomerPhone(input, maxLen = 40) {
	if (input == null) return ''
	const s = sanitizeCustomerPlainText(input, maxLen)
	return s.replace(/[^\d+\s().-]/g, '').trim().slice(0, maxLen)
}

export function sanitizeCustomerEmail(input, maxLen = 160) {
	const s = sanitizeCustomerPlainText(input, maxLen).toLowerCase()
	if (!s) return ''
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return ''
	return s.slice(0, maxLen)
}
