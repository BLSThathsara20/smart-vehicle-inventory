import { ChevronDown } from 'lucide-react'

const SECTION_STYLES = {
  core: 'border-l-4 border-l-amber-500/80',
  technical: 'border-l-4 border-l-emerald-500/80',
  media: 'border-l-4 border-l-blue-500/80',
  listing: 'border-l-4 border-l-violet-500/80',
  documentation: 'border-l-4 border-l-cyan-500/80',
  sale: 'border-l-4 border-l-rose-500/80',
  condition: 'border-l-4 border-l-orange-500/80',
}

export function AccordionSection({ title, open, onToggle, children, variant = 'core' }) {
  const accent = SECTION_STYLES[variant] || SECTION_STYLES.core
  return (
    <div className={`border border-zinc-700/80 rounded-xl overflow-hidden bg-zinc-900/50 ${accent} shadow-sm`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-zinc-800/50 hover:bg-zinc-800 transition"
      >
        <span className="font-medium text-white">{title}</span>
        <ChevronDown
          className={`w-5 h-5 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="p-4 space-y-4 border-t border-zinc-700/80 bg-zinc-900/30">{children}</div>}
    </div>
  )
}
