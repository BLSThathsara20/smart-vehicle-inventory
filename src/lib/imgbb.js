/**
 * Upload a File/Blob to ImgBB; returns HTTPS URL for display/storage in Sanity.
 */
export async function uploadImageToImgbb(file) {
  const key = import.meta.env.VITE_IMGBB_API_KEY
  if (!key) throw new Error('VITE_IMGBB_API_KEY is not set')

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })

  const base64 = String(dataUrl).replace(/^data:.+;base64,/, '')
  const body = new URLSearchParams()
  body.set('key', key)
  body.set('image', base64)

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body,
  })
  const json = await res.json().catch(() => ({}))
  if (!json.success) {
    throw new Error(json?.error?.message || json?.error || 'ImgBB upload failed')
  }
  return json.data.url
}

export const hasImgbbConfig = !!import.meta.env.VITE_IMGBB_API_KEY
