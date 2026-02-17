import { useState, useRef, useEffect } from 'react'
import { X, Camera, Loader2 } from 'lucide-react'
import { recognizePlateFromImage } from '../lib/plateRecognition'

export function CameraCapture({ onCapture, onClose }) {
  const [stream, setStream] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
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
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
    })
  }

  const handleCapture = async () => {
    if (scanning) return
    const blob = await captureFrame()
    if (!blob) return
    setScanning(true)
    try {
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
      const result = await recognizePlateFromImage(file)
      onCaptureRef.current({ plate: result })
    } catch {
      onCaptureRef.current({ plate: null })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-black/80">
        <span className="text-white font-medium">Scan plate or stock ID</span>
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-black/80">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              <span className="text-white text-sm">Reading text...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 pb-8 safe-area-pb flex flex-col items-center gap-3">
        <p className="text-slate-400 text-sm text-center">
          Point at plate or stock ID, then tap to capture
        </p>
        <button
          type="button"
          onClick={handleCapture}
          disabled={scanning || !stream}
          className="w-20 h-20 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-orange-500/30"
          aria-label="Capture"
        >
          <Camera className="w-10 h-10 text-white" />
        </button>
      </div>
    </div>
  )
}
