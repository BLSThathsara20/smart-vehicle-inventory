/**
 * Full-screen status while Firebase + Sanity profile are settling.
 * Uses high-contrast text so status is always visible on dark backgrounds.
 */
export function AuthLoadingScreen({
  title = 'Loading…',
  subtitle = 'Please wait — this usually takes a few seconds.',
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-6 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-12 w-12 shrink-0 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mb-6"
        aria-hidden
      />
      <h1 className="text-xl font-semibold text-white text-center tracking-tight max-w-md">
        {title}
      </h1>
      <p className="text-zinc-300 text-center text-sm mt-3 max-w-sm leading-relaxed">
        {subtitle}
      </p>
    </div>
  )
}
