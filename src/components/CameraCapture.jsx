import { useState, useRef, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { recognizePlateFromImage } from '../lib/plateRecognition'

const SCAN_INTERVAL_MS = 1500
const MIN_RESULT_STABLE = 500

export function CameraCapture({ onCapture, onClose }) {
  const [stream, setStream] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const lastResultRef = useRef(null)
  const lastResultTimeRef = useRef(0)
  const onCaptureRef = useRef(onCapture)
  onCaptureRef.current = onCapture

  useEffect(() => {
    let s = null
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((mediaStream) => {
        s = mediaStream
        setStream(mediaStream)
        if (videoRef.current) videoRef.current.srcObject = mediaStream
      })
      .catch((err) => setError(err.message || 'Camera access denied'))
    return () => {
      if (s) s.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video?.videoWidth || !canvas) return null
    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    })
  }

  const runScan = async () => {
    if (scanning) return
    const blob = await captureFrame()
    if (!blob) return
    setScanning(true)
    try {
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
      const result = await recognizePlateFromImage(file)
      if (result) {
        const now = Date.now()
        if (result === lastResultRef.current && now - lastResultTimeRef.current > MIN_RESULT_STABLE) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          onCaptureRef.current({ plate: result })
          return
        }
        lastResultRef.current = result
        lastResultTimeRef.current = now
      }
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (!stream || !videoRef.current) return
    const startAutoScan = () => {
      const run = () => runScan()
      run()
      intervalRef.current = setInterval(run, SCAN_INTERVAL_MS)
    }
    const video = videoRef.current
    const onReady = () => {
      if (video.videoWidth > 0) startAutoScan()
    }
    if (video.readyState >= 2) startAutoScan()
    else video.addEventListener('loadeddata', onReady)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      video.removeEventListener('loadeddata', onReady)
    }
  }, [stream])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-black/80">
        <span className="text-white font-medium">Auto scan</span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {error && (
          <div className="absolute top-4 left-4 right-4 p-4 rounded-lg bg-red-900/80 text-red-200 text-sm">
            {error}
          </div>
        )}
        {stream && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
        {scanning && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
            <span className="text-white text-sm">Scanning...</span>
          </div>
        )}
      </div>

      <div className="p-4 pb-8 safe-area-pb text-center">
        <p className="text-slate-400 text-sm">Point at plate or stock ID</p>
      </div>
    </div>
  )
}
