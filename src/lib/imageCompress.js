import imageCompression from 'browser-image-compression'

const DEFAULT_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.8,
}

export async function compressImage(file) {
  try {
    const compressed = await imageCompression(file, DEFAULT_OPTIONS)
    return compressed
  } catch (err) {
    console.warn('Compression failed, using original:', err)
    return file
  }
}

export async function compressImages(files) {
  return Promise.all(files.map(compressImage))
}
