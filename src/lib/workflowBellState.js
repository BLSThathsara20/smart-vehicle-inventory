const STORAGE_KEY = 'vehicle-inv-workflow-bell-v1'

/** @returns {Record<string, { at: string }>} */
function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeRaw(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    /* ignore quota */
  }
}

export function instanceKey(vehicleId, instanceId) {
  return `${vehicleId}:${instanceId}`
}

/** Call when user opens a work path (panel or detail) so discussion stops ringing. */
export function setInstanceDiscussionSeen(vehicleId, instanceId) {
  if (!vehicleId || !instanceId) return
  const raw = readRaw()
  raw[instanceKey(vehicleId, instanceId)] = { at: new Date().toISOString() }
  writeRaw(raw)
}

export function getInstanceDiscussionLastSeen(vehicleId, instanceId) {
  if (!vehicleId || !instanceId) return null
  return readRaw()[instanceKey(vehicleId, instanceId)]?.at || null
}
