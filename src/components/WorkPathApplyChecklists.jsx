import { useEffect, useRef, useState } from 'react'
import { Type, ImagePlus, Camera, Loader2, X } from 'lucide-react'
import { newWorkflowSubtaskKey } from '../lib/sanityData'
import { compressImage } from '../lib/imageCompress'
import { uploadImageToImgbb, hasImgbbConfig } from '../lib/imgbb'

function SimpleCaptureModal({ onClose, onCaptureFile, addNotification }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let s = null
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        s = media
        setStream(media)
        if (videoRef.current) videoRef.current.srcObject = media
      })
      .catch((err) => {
        addNotification(err.message || 'Camera access denied', 'error')
        onClose()
      })
    return () => {
      cancelled = true
      if (s) s.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per modal mount
  }, [])

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  async function takePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video?.videoWidth || !canvas || busy) return
    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88)
    })
    if (!blob) return
    const file = new File([blob], 'checklist-capture.jpg', { type: 'image/jpeg' })
    setBusy(true)
    try {
      await onCaptureFile(file)
      onClose()
    } catch (e) {
      addNotification(e.message || 'Could not use photo', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-600 bg-zinc-900 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <p className="text-sm font-medium text-white">Take photo</p>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="p-3 flex gap-2">
          <button
            type="button"
            onClick={takePhoto}
            disabled={busy || !stream}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Use photo
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Per-step checklist when assigning a work path to a vehicle (text + compressed ImgBB photos, optional captions).
 */
export function WorkPathApplyChecklists({
  templateSteps,
  subtasksByStepKey,
  onSubtasksByStepKeyChange,
  disabled,
  addNotification,
}) {
  const [cameraForStepKey, setCameraForStepKey] = useState(null)
  const [uploadingStepKey, setUploadingStepKey] = useState(null)

  function subsFor(stepKey) {
    return subtasksByStepKey[stepKey] || []
  }

  function setSubs(stepKey, list) {
    onSubtasksByStepKeyChange({ ...subtasksByStepKey, [stepKey]: list })
  }

  function addTextLine(stepKey) {
    setSubs(stepKey, [
      ...subsFor(stepKey),
      { _key: newWorkflowSubtaskKey(), kind: 'text', body: '' },
    ])
  }

  function updateRow(stepKey, taskKey, patch) {
    setSubs(
      stepKey,
      subsFor(stepKey).map((t) => (t._key === taskKey ? { ...t, ...patch } : t))
    )
  }

  function removeRow(stepKey, taskKey) {
    setSubs(
      stepKey,
      subsFor(stepKey).filter((t) => t._key !== taskKey)
    )
  }

  async function addPhotoFromFile(stepKey, file) {
    if (!hasImgbbConfig) {
      addNotification('Image upload is not configured (missing VITE_IMGBB_API_KEY)', 'error')
      return
    }
    if (!file?.size) return
    setUploadingStepKey(stepKey)
    try {
      const compressed = await compressImage(file)
      const url = await uploadImageToImgbb(compressed)
      setSubs(stepKey, [
        ...subsFor(stepKey),
        {
          _key: newWorkflowSubtaskKey(),
          kind: 'image',
          body: '',
          image_url: url,
        },
      ])
    } catch (e) {
      addNotification(e.message || 'Upload failed', 'error')
    } finally {
      setUploadingStepKey(null)
    }
  }

  if (!templateSteps?.length) return null

  return (
    <>
      {cameraForStepKey ? (
        <SimpleCaptureModal
          onClose={() => setCameraForStepKey(null)}
          onCaptureFile={(file) => addPhotoFromFile(cameraForStepKey, file)}
          addNotification={addNotification}
        />
      ) : null}

      <div className="space-y-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Step checklists (optional)</p>
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Add tasks for this vehicle only. Photos are compressed and uploaded. Optional captions help your team know what
          each picture is for.
        </p>
        {templateSteps.map((step, i) => {
          const stepKey = step._key
          if (!stepKey) return null
          const list = subsFor(stepKey)
          const uploading = uploadingStepKey === stepKey
          return (
            <div key={stepKey} className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-3 space-y-2">
              <p className="text-xs font-medium text-zinc-300">
                Step {i + 1}: <span className="text-white">{step.title || '—'}</span>
              </p>
              {list.map((t) => (
                <div key={t._key} className="rounded-lg border border-zinc-700/50 bg-zinc-950/40 p-2 space-y-1.5">
                  {t.kind === 'image' ? (
                    <>
                      <div className="flex gap-2 items-start">
                        <div className="w-16 h-14 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                          {t.image_url ? (
                            <img src={t.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-600">
                              —
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            value={t.body}
                            onChange={(e) => updateRow(stepKey, t._key, { body: e.target.value })}
                            placeholder="Optional caption…"
                            disabled={disabled}
                            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-white text-xs placeholder-zinc-600"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => removeRow(stepKey, t._key)}
                          className="text-[10px] text-red-400/90 hover:text-red-300 shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <Type className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <input
                        value={t.body}
                        onChange={(e) => updateRow(stepKey, t._key, { body: e.target.value })}
                        placeholder="Describe this sub-task…"
                        disabled={disabled}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-white text-xs"
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => removeRow(stepKey, t._key)}
                        className="text-[10px] text-red-400/90 hover:text-red-300 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => addTextLine(stepKey)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
                >
                  <Type className="w-3.5 h-3.5" />
                  Text line
                </button>
                <label
                  className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-[11px] text-zinc-300 hover:border-zinc-500 cursor-pointer ${
                    disabled || uploading ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading…' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={disabled || uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) addPhotoFromFile(stepKey, f)
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={disabled || uploading || !hasImgbbConfig}
                  onClick={() => setCameraForStepKey(stepKey)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-[11px] text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
                  title={!hasImgbbConfig ? 'Configure ImgBB to use photos' : 'Take a photo with the camera'}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Camera
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
