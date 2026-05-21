/** Drop thousand separators and trim. */
export function stripNumberGrouping(s) {
	return String(s ?? "")
		.replace(/,/g, "")
		.trim();
}

/** Parse integer from a display string that may include commas. */
export function parseCommaInt(raw) {
	const clean = stripNumberGrouping(raw).replace(/\D/g, "");
	if (!clean) return null;
	const n = parseInt(clean, 10);
	return Number.isFinite(n) ? n : null;
}

/** Parse decimals (e.g. prices) allowing commas as grouping. */
export function parseCommaDecimal(raw) {
	let s = stripNumberGrouping(raw).replace(/[^\d.]/g, "");
	const i = s.indexOf(".");
	if (i !== -1) {
		s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
	}
	if (!s) return null;
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
}

/** Integer display with separators while typing (UK locale). */
export function formatTypingIntDigits(inputDisplay) {
	const digits = stripNumberGrouping(inputDisplay).replace(/\D/g, "");
	if (!digits) return "";
	const n = parseInt(digits, 10);
	return Number.isFinite(n) ? n.toLocaleString("en-GB") : "";
}

/**
 * Monetary / decimal typing with commas on the integer part.
 * Keeps one decimal separator and fractional digits up to maxFractionDigits.
 */
export function formatTypingMoney(
	inputDisplay,
	{ treatTrailingDot = false, maxFractionDigits = 2 } = {},
) {
	let s = String(inputDisplay ?? "");
	const endsWithDot = /\.\s*$/.test(s);
	let core = stripNumberGrouping(s).replace(/[^\d.]/g, "");
	const dotIdx = core.indexOf(".");
	if (dotIdx !== -1)
		core =
			core.slice(0, dotIdx + 1) + core.slice(dotIdx + 1).replace(/\./g, "");
	const [wholeRaw, fracRaw] = core.includes(".") ? core.split(".") : [core, null];
	const dWhole = wholeRaw.replace(/\D/g, "");
	let wholeNum = parseInt(dWhole || "0", 10);
	if (!Number.isFinite(wholeNum)) wholeNum = 0;
	const wholeFmt = wholeNum.toLocaleString("en-GB");
	let out = "";
	if (fracRaw != null && fracRaw.length > 0) {
		const frac = fracRaw.replace(/\D/g, "").slice(0, maxFractionDigits);
		out = `${wholeFmt}.${frac}`;
	} else if (dotIdx !== -1 || (endsWithDot && treatTrailingDot)) out = `${wholeFmt}.`;
	else if (core === "." || (wholeRaw === "" && dotIdx !== -1)) out = "";
	else out = wholeFmt === "0" && !dWhole ? "" : wholeFmt;

	return out;
}

/** Initialise display for an integer from API (number|null). */
export function intToDisplayComma(n) {
	if (n == null || n === "") return "";
	const num = typeof n === "number" ? n : parseInt(stripNumberGrouping(String(n)), 10);
	return Number.isFinite(num) ? num.toLocaleString("en-GB") : "";
}

/** Initialise price display from API number. */
export function decimalToDisplayComma(n) {
	if (n == null || n === "") return "";
	const num = typeof n === "number" ? n : parseCommaDecimal(String(n));
	if (!Number.isFinite(num)) return "";
	const hasFrac = Math.abs(num % 1) > 1e-9;
	return num.toLocaleString("en-GB", {
		minimumFractionDigits: hasFrac ? 2 : 0,
		maximumFractionDigits: 2,
	});
}
