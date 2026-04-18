import { NavLink, useLocation } from 'react-router-dom'
import { LayoutGrid, Car, PlusCircle, Settings, Activity, HardDrive, Shield, Users as UsersIcon, Bell, Route, ClipboardList, BarChart3 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ASAHI_LOGO_URL, ASAHI_BRAND_NAME, ASAHI_PRODUCT_TITLE } from '../constants/branding'

const mainNavItems = [
  { to: '/app', icon: LayoutGrid, label: 'Overview', permission: 'search:view' },
  { to: '/app/inventory', icon: Car, label: 'Inventory', permission: 'inventory:view' },
  { to: '/app/analytics', icon: BarChart3, label: 'Analytics', permission: 'analytics:view' },
  { to: '/app/my-work', icon: ClipboardList, label: 'My work', permission: 'inventory:view' },
  { to: '/app/add', icon: PlusCircle, label: 'Add Vehicle', permission: 'inventory:add' },
]

const secondaryNavItems = [
  { to: '/app/notifications', icon: Bell, label: 'Notifications', permission: 'inventory:view' },
  { to: '/app/health', icon: Activity, label: 'App Health', permission: 'health:view' },
  { to: '/app/space', icon: HardDrive, label: 'Storage & Space', permission: 'space:view' },
  { to: '/app/roles', icon: Shield, label: 'Roles & Permissions', permission: 'roles:manage' },
  { to: '/app/users', icon: UsersIcon, label: 'Users', permission: 'users:manage' },
  { to: '/app/work-paths', icon: Route, label: 'Work paths', permission: 'workflows:manage' },
  { to: '/app/settings', icon: Settings, label: 'Settings', permission: 'settings:view' },
]

export function Sidebar() {
  const location = useLocation()
  const { hasPermission } = useAuth()
  const isOverviewActive = location.pathname === '/app' || location.pathname === '/app/search'

  const filteredMain = mainNavItems.filter((item) => !item.permission || hasPermission(item.permission))
  const filteredSecondary = secondaryNavItems.filter((item) => !item.permission || hasPermission(item.permission))

  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 md:z-30 bg-zinc-900/95 border-r border-zinc-800/80">
      <div className="flex flex-col flex-1 pt-6 pb-4 overflow-y-auto">
        <div className="px-4 mb-8">
          <img
            src={ASAHI_LOGO_URL}
            alt=""
            className="h-9 w-auto max-w-[160px] object-contain object-left mb-3"
            loading="lazy"
          />
          <p className="text-[11px] font-semibold text-amber-500/95 tracking-wide uppercase">{ASAHI_BRAND_NAME}</p>
          <h2 className="text-base font-semibold text-white tracking-tight mt-1">{ASAHI_PRODUCT_TITLE}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Management</p>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <p className="px-3 mb-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            Main
          </p>
          {filteredMain.map((item) => {
            const Icon = item.icon
            const isActive = item.to === '/app' ? isOverviewActive : location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to !== '/app'}
                className={() =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </NavLink>
            )
          })}

          <p className="px-3 mt-6 mb-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            System
          </p>
          {filteredSecondary.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
