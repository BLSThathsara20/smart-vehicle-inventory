import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      <main className="max-w-lg mx-auto px-4 pt-4">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
