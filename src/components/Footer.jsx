import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="w-full py-6 text-center text-slate-500 text-sm">
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
        <Link to="/privacy" className="text-amber-400 hover:text-amber-300">
          Privacy & Data Protection
        </Link>
      </p>
    </footer>
  )
}
