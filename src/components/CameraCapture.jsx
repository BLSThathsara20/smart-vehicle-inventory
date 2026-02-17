import { useState, useRef, useEffect } from 'react'
import { X, Camera, Loader2, Check, XCircle } from 'lucide-react'
import { recognizeAllFromImage } from '../lib/plateRecognition'

export function CameraCapture({ onCapture, onClose, searchFn }) {
  const [stream, setStream] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | reading | searching
  const [candidates, setCandidates] = useState([])
  const [searchStatus, setSearchStatus] = useState([]) // { query, status: 'searching'|'found'|'not_found', vehicles? }
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
    if (phase !== 'idle') return
    const blob = await captureFrame()
    if (!blob) return

    setPhase('reading')
    setCandidates([])
    setSearchStatus([])

    try {
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
      const all = await recognizeAllFromImage(file)

      if (!all || all.length === 0) {
        onCaptureRef.current({ plate: null, candidates: [] })
        setPhase('idle')
        return
      }

      setCandidates(all)
      setPhase('searching')

      if (!searchFn) {
        onCaptureRef.current({ plate: all[0], candidates: all })
        setPhase('idle')
        return
      }

      for (let i = 0; i < all.length; i++) {
        const q = all[i]
        setSearchStatus((prev) => [
          ...prev.slice(0, i),
          { query: q, status: 'searching' },
          ...prev.slice(i + 1),
        ])

        const { vehicles } = await searchFn(q)

        if (vehicles && vehicles.length > 0) {
          setSearchStatus((prev) =>
            prev.map((s, j) => (j === i ? { ...s, status: 'found', vehicles } : s))
          )
          onCaptureRef.current({ plate: q, vehicles, candidates: all })
          setPhase('idle')
          return
        }

        setSearchStatus((prev) =>
          prev.map((s, j) => (j === i ? { ...s, status: 'not_found' } : s))
        )
      }

      onCaptureRef.current({ plate: null, candidates: all })
    } catch {
      onCaptureRef.current({ plate: null, candidates: [] })
    } finally {
      setPhase('idle')
    }
  }

  const lastTapRef = useRef(0)
  const handleDoubleTap = (e) => {
    if (phase !== 'idle' || !stream) return
    const now = Date.now()
    if (now - lastTapRef.current < 400) {
      lastTapRef.current = 0
      handleCapture()
    } else {
      lastTapRef.current = now
    }
  }

  const scanning = phase === 'reading' || phase === 'searching'

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col h-screen overflow-hidden">
      <div className="shrink-0 flex justify-between items-center p-4 bg-black/80">
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

      <div
        data-video-area
        className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden"
        onClick={handleDoubleTap}
      >
        {error && (
          <div className="absolute top-4 left-4 right-4 p-4 rounded-lg bg-red-900/80 text-red-200 text-sm z-10">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 z-10 p-4">
            {phase === 'reading' && (
              <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-black/80">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                <span className="text-white text-sm">Reading text...</span>
              </div>
            )}
            {phase === 'searching' && (
              <div className="w-full max-w-sm space-y-2 rounded-xl bg-black/80 p-4">
                <p className="text-slate-300 text-sm font-medium mb-2">
                  Detected: {candidates.join(', ')}
                </p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {searchStatus.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm"
                    >
                      {s.status === 'searching' && (
                        <Loader2 className="w-4 h-4 text-orange-500 animate-spin shrink-0" />
                      )}
                      {s.status === 'found' && (
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                      )}
                      {s.status === 'not_found' && (
                        <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className="text-white font-mono">{s.query}</span>
                      <span className="text-slate-400">
                        {s.status === 'searching' && 'Searching...'}
                        {s.status === 'found' && `✓ ${s.vehicles?.length || 0} found`}
                        {s.status === 'not_found' && 'Not found'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 p-4 pb-8 safe-area-pb flex flex-col items-center gap-3 bg-black">
        <p className="text-slate-400 text-sm text-center">
          Tap button or double-tap video to capture
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
