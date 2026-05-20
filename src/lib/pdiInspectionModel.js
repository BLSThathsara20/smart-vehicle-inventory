/**
 * Pre-Delivery Inspection (PDI) — ASAHIMOTORS-style checklist (app-side model).
 * Stored on vehicle as `pdi_inspection_json` string in Sanity (see README).
 */

export const PDI_SCHEMA_VERSION = 1

/** @type {{ key: string, label: string }[]} */
export const PDI_CHECKS_COL1 = [
  { key: 'hazard_lights_indicators', label: 'Hazard lights / indicators' },
  { key: 'brake_lights', label: 'Brake lights' },
  { key: 'reverse_lights', label: 'Reverse lights' },
  { key: 'dipped_headlights', label: 'Dipped headlights' },
  { key: 'high_beam_lights', label: 'High beam lights' },
  { key: 'cluster_lights', label: 'Cluster lights' },
  { key: 'interior_lights', label: 'Interior lights' },
  { key: 'etc_removed', label: 'Etc removed' },
  { key: 'speakers', label: 'Speakers' },
  { key: 'carplay_audio_speakers', label: 'CarPlay audio (all speakers)' },
  { key: 'car_interior_cleaned', label: 'Car interior cleaned' },
  { key: 'service_done', label: 'Service done' },
  { key: 'power_steering', label: 'Power steering' },
  { key: 'stickers_removed', label: 'Stickers removed' },
  { key: 'road_tested', label: 'Road tested' },
  { key: 'engine_mounts', label: 'Engine mounts' },
  { key: 'all_doors_locking', label: 'All doors locking (key & immobiliser)' },
  { key: 'cv_joint_boot_check', label: 'CV joint & bolt joint boot check' },
]

/** @type {{ key: string, label: string }[]} */
export const PDI_CHECKS_COL2 = [
  { key: 'mirrors_motor', label: 'Mirrors motor' },
  { key: 'mileage_matching_mot', label: 'Mileage matching MOT' },
  { key: 'seat_belts_all', label: 'Seat belts (all)' },
  { key: 'brake_pad_disc', label: 'Brake pad / disc' },
  { key: 'ac_heating', label: 'A/C & heating' },
  { key: 'windows_demist', label: 'Windows demist' },
  { key: 'carplay', label: 'CarPlay' },
  { key: 'reverse_cam', label: 'Reverse cam' },
  { key: 'windows', label: 'Windows' },
  { key: 'ports_12v', label: '12V charging ports' },
  { key: 'hand_brake_check', label: 'Hand brake check' },
  { key: 'car_washed_outside', label: 'Car washed outside' },
  { key: 'tyre_pressure_same', label: 'Tyre pressure all same' },
  { key: 'cluster_converted', label: 'Cluster converted' },
  { key: 'android_screen_tested', label: 'Android screen (tested)' },
  { key: 'engine_noise', label: 'Engine noise' },
  { key: 'tyre_bolts_secured', label: 'All bolts secured on tyres' },
  { key: 'boot_locking', label: 'Boot locking properly' },
  { key: 'windshield_fluid', label: 'Windshield fluid check' },
]

/** @type {{ key: string, label: string, hint?: string }[]} */
export const PDI_TYRE_KEYS = [
  { key: 'fr', label: 'FR', hint: 'Front right' },
  { key: 'fl', label: 'FL', hint: 'Front left' },
  { key: 'rr', label: 'RR', hint: 'Rear right' },
  { key: 'rl', label: 'RL', hint: 'Rear left' },
]

export const PDI_TYRE_POSITION_KEYS = ['fr', 'fl', 'rr', 'rl']

/** Tyre tread depth / note per corner (stored as string, e.g. mm). */
export function normalizeTyreTreadCell(raw) {
	if (raw === true || raw === 'true') return 'OK'
	if (raw === false || raw == null) return ''
	return String(raw).trim()
}

export function isTyreTreadCellFilled(value) {
	return normalizeTyreTreadCell(value) !== ''
}
/** Mechanic photo checklist */
export const PDI_MECHANIC_CHECKS = [
  { key: 'photo_dipstick_old_oil', label: 'Photo of dipstick — old oil' },
  { key: 'photo_dipstick_new_oil', label: 'Photo of dipstick — new oil' },
  { key: 'photo_old_filters', label: 'Photo of old oil, air & cabin filters' },
  { key: 'photo_new_filters_agl', label: 'Photo of new filters with AGL' },
]

/** @typedef {Record<string, boolean>} ChecksMap */

/** @returns {ChecksMap} */
function emptyChecksMap(keys) {
  const m = {}
  for (const { key } of keys) m[key] = false
  return m
}

export function emptyPdiTyres() {
	return { fr: '', fl: '', rr: '', rl: '' }
}

/** @typedef {{
 *   schema_version?: number,
 *   header?: {
 *     reg_number?: string,
 *     vin_number?: string,
 *     mileage?: string,
 *     date_iso?: string,
 *     make_model?: string,
 *     customer?: string,
 *     assessor?: string,
 *     signature?: string,
 *     md_signature?: string,
 *   },
 *   checks_main?: ChecksMap,
 *   tyre_tread?: { fr?: string, fl?: string, rr?: string, rl?: string },
 *   checks_mechanic?: ChecksMap,
 *   damages?: string,
 *   finalized_at?: string | null,
 *   finalized_by_uid?: string | null,
 *   finalized_by_name?: string | null,
 * }} PdiInspectionState */

export function createEmptyPdiInspection() {
  return {
    schema_version: PDI_SCHEMA_VERSION,
    header: {
      reg_number: '',
      vin_number: '',
      mileage: '',
      date_iso: new Date().toISOString().slice(0, 10),
      make_model: '',
      customer: '',
      assessor: '',
      signature: '',
      md_signature: '',
    },
    checks_main: {
      ...emptyChecksMap(PDI_CHECKS_COL1),
      ...emptyChecksMap(PDI_CHECKS_COL2),
    },
    tyre_tread: emptyPdiTyres(),
    checks_mechanic: emptyChecksMap(PDI_MECHANIC_CHECKS),
    damages: '',
    finalized_at: null,
    finalized_by_uid: null,
    finalized_by_name: null,
  }
}

/** @param {Record<string, unknown>|null} doc */
export function normalizePdiInspection(doc) {
  const base = createEmptyPdiInspection()
  if (!doc || typeof doc !== 'object') return base
  const d = doc
  base.header = { ...base.header, ...(typeof d.header === 'object' && d.header ? d.header : {}) }
  base.checks_main = {
    ...(base.checks_main || {}),
    ...(typeof d.checks_main === 'object' && d.checks_main ? d.checks_main : {}),
  }
  Object.keys(base.checks_main).forEach((k) => {
    base.checks_main[k] = !!base.checks_main[k]
  })
	base.tyre_tread = {
		...(base.tyre_tread || emptyPdiTyres()),
		...(typeof d.tyre_tread === 'object' && d.tyre_tread ? d.tyre_tread : {}),
	}
	for (const t of PDI_TYRE_POSITION_KEYS) {
		base.tyre_tread[t] = normalizeTyreTreadCell(base.tyre_tread[t])
	}
  base.checks_mechanic = {
    ...(base.checks_mechanic || {}),
    ...(typeof d.checks_mechanic === 'object' && d.checks_mechanic ? d.checks_mechanic : {}),
  }
  Object.keys(base.checks_mechanic).forEach((k) => {
    base.checks_mechanic[k] = !!base.checks_mechanic[k]
  })
  base.damages = typeof d.damages === 'string' ? d.damages : base.damages
  base.finalized_at = d.finalized_at != null ? String(d.finalized_at) : null
  base.finalized_by_uid = d.finalized_by_uid != null ? String(d.finalized_by_uid) : null
  base.finalized_by_name = d.finalized_by_name != null ? String(d.finalized_by_name) : null
  base.schema_version =
    typeof d.schema_version === 'number' ? d.schema_version : PDI_SCHEMA_VERSION
  return base
}

/**
 * Prefill header from reservation + vehicle basics.
 * @param {Partial<{ plate_no?: string|null, vin?: string|null, mileage?: number|null, brand?: string|null, model?: string|null, customer_name?: string|null }>} vehicle
 * @param {{ customer_name?: string, plate_no_hint?: string }} [extra]
 */
export function seedPdiFromVehicleAndCustomer(vehicle, extra = {}) {
  const pdi = createEmptyPdiInspection()
  const mileageRaw = vehicle?.mileage
  const mileage =
    mileageRaw != null && String(mileageRaw).trim() !== '' ? String(mileageRaw).trim() : ''
  const mm = [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ')
  if (vehicle?.plate_no) pdi.header.reg_number = String(vehicle.plate_no).trim().toUpperCase()
  if (extra.plate_no_hint && !pdi.header.reg_number) {
    pdi.header.reg_number = String(extra.plate_no_hint).trim().toUpperCase()
  }
  if (vehicle?.vin) pdi.header.vin_number = String(vehicle.vin).trim()
  if (mileage) pdi.header.mileage = mileage.replace(/[^\d]/g, '') || mileage
  if (mm.trim()) pdi.header.make_model = mm.trim()
  const cust =
    extra.customer_name != null ? String(extra.customer_name).trim() : ''
  const vCust =
    vehicle?.customer_name != null ? String(vehicle.customer_name).trim() : ''
  if (cust) pdi.header.customer = cust
  else if (vCust) pdi.header.customer = vCust
  return pdi
}

/** @returns {{ checked: number, total: number }} */
export function pdiCheckboxProgress(inspection) {
  const normalized = normalizePdiInspection(inspection)
  let total = 0
  let checked = 0
  function count(map) {
    if (!map) return
    for (const k of Object.keys(map)) {
      total += 1
      if (map[k]) checked += 1
    }
  }
  count(normalized.checks_main)
  for (const k of PDI_TYRE_POSITION_KEYS) {
    total += 1
    if (isTyreTreadCellFilled(normalized.tyre_tread?.[k])) checked += 1
  }
  count(normalized.checks_mechanic)
  return { checked, total }
}

export function isPdiFinalized(inspection) {
  const n = normalizePdiInspection(inspection)
  return Boolean(n.finalized_at && String(n.finalized_at).trim())
}

/** Clears completion metadata so the checklist can be finalized again (e.g. after Undo PDI on vehicle page). */
export function stripPdiFinalization(inspection) {
  const n = normalizePdiInspection(inspection)
  return normalizePdiInspection({
    ...n,
    finalized_at: null,
    finalized_by_uid: null,
    finalized_by_name: null,
  })
}

/** Stringify for Sanity text field `pdi_inspection_json`. */
export function serializePdiForStorage(inspection) {
  return JSON.stringify(normalizePdiInspection(inspection))
}

export function deserializePdiFromStorage(raw) {
  if (!raw) return normalizePdiInspection(null)
  if (typeof raw === 'object') return normalizePdiInspection(raw)
  try {
    return normalizePdiInspection(JSON.parse(String(raw)))
  } catch {
    return normalizePdiInspection(null)
  }
}
