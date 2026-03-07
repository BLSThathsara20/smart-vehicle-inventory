import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { Footer } from './Footer'

export function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white md:flex">
      <Sidebar />
      <div className="flex-1 md:pl-56 min-h-screen flex flex-col">
        <main className="flex-1 w-full max-w-lg md:max-w-4xl mx-auto px-4 pt-4 pb-24 md:pb-8">
          <Outlet />
        </main>
        <Footer />
      </div>
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
