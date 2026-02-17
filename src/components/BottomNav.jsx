import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Car, Plus, Search, Settings, Activity, MoreVertical, HardDrive } from 'lucide-react'

const moreMenuItems = [
  { to: '/app/health', icon: Activity, label: 'App Health' },
  { to: '/app/space', icon: HardDrive, label: 'Storage & Space' },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const isMoreActive = moreMenuItems.some((item) => location.pathname === item.to)
  const isSearchActive = location.pathname === '/app' || location.pathname === '/app/search'

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMoreOpen(false)
      }
    }
    if (moreOpen) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => document.removeEventListener('click', handleClickOutside)
  }, [moreOpen])

  const handleMoreItemClick = (to) => {
    navigate(to)
    setMoreOpen(false)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-700 safe-area-pb">
      <div className="flex items-end justify-center gap-1 h-20 max-w-lg mx-auto px-2">
        {/* Inventory */}
        <NavLink
          to="/app/inventory"
          className={({ isActive }) =>
            `flex flex-col items-center justify-end flex-1 pb-3 pt-2 gap-1 transition ${
              isActive ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <Car className="w-6 h-6" />
          <span className="text-xs font-medium">Inventory</span>
        </NavLink>

        {/* Add Vehicle */}
        <NavLink
          to="/app/add"
          className={({ isActive }) =>
            `flex flex-col items-center justify-end flex-1 pb-3 pt-2 gap-1 transition ${
              isActive ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          <Plus className="w-6 h-6" />
          <span className="text-xs font-medium">Add</span>
        </NavLink>

        {/* Search - center, big, creative */}
        <div className="flex-1 flex justify-center items-end pb-2">
          <NavLink
            to="/app"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-14 h-14 -mt-4 rounded-2xl shadow-lg transition-all duration-200 ${
                isActive || isSearchActive
                  ? 'bg-orange-500 text-white shadow-orange-500/30 scale-105'
                  : 'bg-slate-800 text-slate-300 hover:bg-orange-500/20 hover:text-orange-400 border border-slate-700'
              }`
            }
          >
            <Search className="w-7 h-7" strokeWidth={2.5} />
            <span className="text-[10px] font-semibold mt-0.5">Search</span>
          </NavLink>
        </div>

        {/* More - three dots */}
        <div className="flex-1 flex justify-center items-end pb-3 pt-2 relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex flex-col items-center gap-1 transition ${
              isMoreActive ? 'text-orange-500' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            <MoreVertical className="w-6 h-6" />
            <span className="text-xs font-medium">More</span>
          </button>

          {/* More menu popover */}
          {moreOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 py-2 rounded-xl bg-slate-800 border border-slate-700 shadow-xl animate-slide-up">
              {moreMenuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => handleMoreItemClick(item.to)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                      location.pathname === item.to
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </nav>
  )
}
