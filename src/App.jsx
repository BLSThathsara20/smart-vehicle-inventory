import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { NotificationToast } from './components/NotificationToast'
import { Login } from './components/Login'
import { Layout } from './components/Layout'
import { VehicleList } from './pages/VehicleList'
import { AddVehicle } from './pages/AddVehicle'
import { VehicleDetail } from './pages/VehicleDetail'
import { Search } from './pages/Search'
import { PublicFind } from './pages/PublicFind'
import { Settings } from './pages/Settings'
import { Health } from './pages/Health'
import { Space } from './pages/Space'
import { Roles } from './pages/Roles'
import { Users } from './pages/Users'
import { Notifications } from './pages/Notifications'
import { CustomerPickup } from './pages/CustomerPickup'
import { Privacy } from './pages/Privacy'
import { ResetPassword } from './pages/ResetPassword'
import { RequirePermission } from './components/RequirePermission'

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-4">
        <p className="text-zinc-400 text-center">No access. Contact your administrator.</p>
        <p className="text-zinc-600 text-sm mt-2">Run the RBAC migration if you haven&apos;t yet.</p>
      </div>
    )
  }
  return children
}

function LoginRedirect({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (user) return <Navigate to="/app" replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  return <Navigate to={user ? '/app' : '/find'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      {/* Public - no login required */}
      <Route path="/find" element={<PublicFind />} />
      <Route path="/pickup/:token" element={<CustomerPickup />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Internal - login required (reservation workflow, full vehicle detail) */}
      <Route path="/vehicle/:id" element={<ProtectedRoute><VehicleDetail /></ProtectedRoute>} />
      <Route path="/login" element={<LoginRedirect><Login /></LoginRedirect>} />

      {/* Protected - admin only */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RequirePermission permission="search:view"><Search /></RequirePermission>} />
        <Route path="inventory" element={<RequirePermission permission="inventory:view"><VehicleList /></RequirePermission>} />
        <Route path="add" element={<RequirePermission permission="inventory:add"><AddVehicle /></RequirePermission>} />
        <Route path="search" element={<RequirePermission permission="search:view"><Search /></RequirePermission>} />
        <Route path="notifications" element={<RequirePermission permission="inventory:view"><Notifications /></RequirePermission>} />
        <Route path="health" element={<RequirePermission permission="health:view"><Health /></RequirePermission>} />
        <Route path="space" element={<RequirePermission permission="space:view"><Space /></RequirePermission>} />
        <Route path="roles" element={<RequirePermission permission="roles:manage"><Roles /></RequirePermission>} />
        <Route path="users" element={<RequirePermission permission="users:manage"><Users /></RequirePermission>} />
        <Route path="settings" element={<RequirePermission permission="settings:view"><Settings /></RequirePermission>} />
      </Route>

      <Route path="*" element={<Navigate to="/find" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppRoutes />
          <NotificationToast />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
