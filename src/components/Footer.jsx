import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="w-full pt-6 pb-safe-public text-center text-slate-500 text-sm">
      <p>
        © {new Date().getFullYear()}{' '}
        <a
          href="https://savithathsara.me"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 hover:text-amber-300"
        >
          Savindu Thathsara
        </a>
        {' · '}
        <Link to="/pullouts" className="text-amber-400 hover:text-amber-300">
          Scheduled collections
        </Link>
        {' · '}
        <Link to="/privacy" className="text-amber-400 hover:text-amber-300">
          Privacy notice (UK)
        </Link>
      </p>
      <p className="mt-2 text-[11px] text-slate-600 max-w-xl mx-auto">
        UK GDPR &amp; Data Protection Act 2018 — how we handle personal information.
      </p>
    </footer>
  )
}
