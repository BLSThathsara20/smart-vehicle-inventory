import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid, Car, PlusCircle, MoreHorizontal, Settings, Activity, HardDrive, Shield, Users as UsersIcon, Bell, Route, ClipboardList, BarChart3 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const moreMenuItems = [
  { to: '/app/notifications', icon: Bell, label: 'Notifications', permission: 'inventory:view' },
  { to: '/app/health', icon: Activity, label: 'App Health', permission: 'health:view' },
  { to: '/app/space', icon: HardDrive, label: 'Storage & Space', permission: 'space:view' },
  { to: '/app/roles', icon: Shield, label: 'Roles & Permissions', permission: 'roles:manage' },
  { to: '/app/users', icon: UsersIcon, label: 'Users', permission: 'users:manage' },
  { to: '/app/work-paths', icon: Route, label: 'Work paths', permission: 'workflows:manage' },
  { to: '/app/settings', icon: Settings, label: 'Settings', permission: 'settings:view' },
]

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission, isSuperAdmin } = useAuth()

  const filteredMoreItems = moreMenuItems.filter(
    (item) => !item.permission || isSuperAdmin() || hasPermission(item.permission)
  )
  const isMoreActive = filteredMoreItems.some((item) => location.pathname === item.to)
  const isOverviewActive = location.pathname === '/app' || location.pathname === '/app/search'

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

  const navItems = [
    { to: '/app', icon: LayoutGrid, label: 'Overview', permission: 'search:view' },
    { to: '/app/inventory', icon: Car, label: 'Inventory', permission: 'inventory:view' },
    { to: '/app/analytics', icon: BarChart3, label: 'Stats', permission: 'analytics:view' },
  { to: '/app/my-work', icon: ClipboardList, label: 'My work', permission: 'inventory:view' },
    { to: '/app/add', icon: PlusCircle, label: 'Add', permission: 'inventory:add' },
  ].filter((item) => !item.permission || isSuperAdmin() || hasPermission(item.permission))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/98 backdrop-blur-xl border-t border-zinc-800/80 safe-area-pb shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.to === '/app' ? isOverviewActive : location.pathname === item.to
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app' ? false : true}
              className={() =>
                `flex flex-col items-center justify-center flex-1 gap-1.5 py-2 transition-all duration-200 ${
                  isActive ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
                }`
              }
            >
              <Icon
                className={`w-5 h-5 transition-all ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`}
              />
              <span
                className={`text-[11px] font-medium tracking-wide ${
                  isActive ? 'text-amber-400' : 'text-zinc-500'
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          )
        })}

        {/* More */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2 relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${
              isMoreActive ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal
              className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`}
            />
            <span
              className={`text-[11px] font-medium tracking-wide ${
                isMoreActive ? 'text-amber-400' : 'text-zinc-500'
              }`}
            >
              More
            </span>
          </button>

          {moreOpen && (
            <>
              <div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                aria-hidden
                onClick={() => setMoreOpen(false)}
              />
              <div className="fixed left-0 right-0 bottom-16 z-[110] md:absolute md:left-1/2 md:right-auto md:bottom-full md:mb-3 md:bottom-auto md:w-56 md:-translate-x-1/2 rounded-t-2xl md:rounded-xl bg-zinc-900 border border-zinc-700/80 border-b-0 md:border-b md:border-zinc-700/80 shadow-2xl py-3 md:py-2 max-h-[65vh] md:max-h-[80vh] overflow-y-auto">
                <div className="w-10 h-1 rounded-full bg-zinc-600 mx-auto mb-2 md:hidden" aria-hidden />
                {filteredMoreItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => handleMoreItemClick(item.to)}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition active:bg-zinc-800/80 ${
                        location.pathname === item.to
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'text-zinc-300 hover:bg-zinc-800/80'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0 text-zinc-400" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
