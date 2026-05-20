import { Loader2 } from 'lucide-react'

/**
 * Loading UI with a single status line driven by the parent (what is actually running).
 * Update `message` when your async step changes — no fake rotating text.
 *
 * @param {object} props
 * @param {string} props.message — short user-facing status (avoid vendor/product names)
 * @param {string} [props.detail] — optional smaller subline (e.g. filter summary)
 * @param {'fullscreen' | 'embedded' | 'compact'} [props.variant]
 * @param {string} [props.className]
 * @param {string} [props.spinnerClassName]
 * @param {string} [props.messageClassName]
 */
export function LoadingState({
  message = 'Loading…',
  detail = null,
  variant = 'embedded',
  className = '',
  spinnerClassName = 'text-amber-500/80',
  messageClassName = 'text-zinc-400',
}) {
  const wrap =
    variant === 'fullscreen'
      ? 'min-h-screen flex flex-col items-center justify-center bg-zinc-950 px-6'
      : variant === 'compact'
        ? 'flex flex-col items-center justify-center py-8 px-4'
        : 'flex flex-col items-center justify-center py-16 px-4'

  const spinnerSize = variant === 'compact' ? 'w-8 h-8 mb-2' : 'w-10 h-10 mb-3'

  return (
    <div
      className={`${wrap} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <Loader2 className={`${spinnerSize} animate-spin shrink-0 ${spinnerClassName}`} aria-hidden />
      <p
        key={message}
        className={`text-sm text-center max-w-md leading-relaxed animate-loading-msg-in ${messageClassName}`}
      >
        {message}
      </p>
      {detail ? (
        <p className="text-xs text-zinc-600 mt-2 text-center max-w-md leading-relaxed">{detail}</p>
      ) : null}
    </div>
  )
}
