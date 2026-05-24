import { Link, useLocation } from 'react-router-dom'

export function Footer() {
  const { pathname, search, hash } = useLocation()
  /** When opening Privacy so Back returns here (e.g. booking → privacy → booking). */
  const fromPublicPath = `${pathname}${search}${hash}`

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
        <Link
          to="/privacy"
          state={{ from: fromPublicPath }}
          className="text-amber-400 hover:text-amber-300"
        >
          Privacy & Data Protection
        </Link>
      </p>
    </footer>
  )
}
