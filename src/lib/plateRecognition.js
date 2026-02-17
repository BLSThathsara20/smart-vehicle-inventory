import Tesseract from 'tesseract.js'

// Optimal for OCR: text height 20-40px. 800px width keeps detail without being too slow.
const MAX_OCR_WIDTH = 800
let workerPromise = null

// UK plate patterns
const UK_PLATE_REGEX = /[A-Z]{2}[0-9]{2}\s?[A-Z]{3}|[A-Z]{1,3}[0-9]{1,4}[A-Z]{0,3}/gi
const STOCK_ID_REGEX = /[A-Z0-9]{3,15}/gi

function getWorker() {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('eng', 1, { logger: () => {} }).then((w) => {
      w.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      })
      return w
    })
  }
  return workerPromise
}

/**
 * Preprocess image for better OCR: resize, grayscale, contrast
 */
function preprocessForOCR(blob) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_OCR_WIDTH / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data

      // Grayscale + contrast enhancement
      const contrast = 1.3
      const brightness = 0
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        const adjusted = (gray - 128) * contrast + 128 + brightness
        const v = Math.max(0, Math.min(255, Math.round(adjusted)))
        data[i] = data[i + 1] = data[i + 2] = v
      }
      ctx.putImageData(imageData, 0, 0)

      canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.92)
    }
    img.src = URL.createObjectURL(blob)
  })
}

export function extractPlateOrStockId(text) {
  const all = extractAllPlateOrStockIds(text)
  return all.length ? all[0] : null
}

/**
 * Extract ALL plate/stock ID candidates from OCR text (for multi-search)
 */
export function extractAllPlateOrStockIds(text) {
  if (!text || typeof text !== 'string') return []
  const t = text.toUpperCase().trim()
  const seen = new Set()
  const results = []

  const plateMatch = t.match(UK_PLATE_REGEX)
  if (plateMatch?.length) {
    plateMatch
      .map((m) => m.replace(/\s/g, ''))
      .filter((p) => p.length >= 5 && p.length <= 12)
      .forEach((p) => {
        if (!seen.has(p)) {
          seen.add(p)
          results.push(p)
        }
      })
  }

  const stockMatch = t.match(STOCK_ID_REGEX)
  if (stockMatch?.length) {
    stockMatch
      .map((m) => m.replace(/\s/g, ''))
      .filter((p) => p.length >= 3 && p.length <= 15)
      .sort((a, b) => b.length - a.length)
      .forEach((p) => {
        if (!seen.has(p)) {
          seen.add(p)
          results.push(p)
        }
      })
  }

  return results
}

/**
 * OCR for plate/stock ID - preprocessed image, SPARSE_TEXT for full-frame photos
 */
export async function recognizePlateFromImage(imageFile) {
  const all = await recognizeAllFromImage(imageFile)
  return all.length ? all[0] : null
}

/**
 * OCR - returns ALL detected plate/stock ID candidates for multi-search
 */
export async function recognizeAllFromImage(imageFile) {
  const blob = imageFile instanceof Blob ? imageFile : await imageFile
  const preprocessed = await preprocessForOCR(blob)
  const worker = await getWorker()
  const { data } = await worker.recognize(preprocessed)
  return extractAllPlateOrStockIds(data?.text)
}
