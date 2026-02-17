export function Footer() {
  return (
    <footer className="w-full py-6 text-center text-slate-500 text-sm">
      <p>
        © {new Date().getFullYear()}{' '}
        <a
          href="https://savithathsara.me"
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 hover:text-orange-300"
        >
          Savindu Thathsara
        </a>
      </p>
    </footer>
  )
}
