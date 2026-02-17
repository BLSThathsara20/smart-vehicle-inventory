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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function LoginRedirect({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/app" replace />
  return children
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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
      <Route path="/vehicle/:id" element={<VehicleDetail />} />
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
        <Route index element={<Search />} />
        <Route path="inventory" element={<VehicleList />} />
        <Route path="add" element={<AddVehicle />} />
        <Route path="search" element={<Search />} />
        <Route path="health" element={<Health />} />
        <Route path="space" element={<Space />} />
        <Route path="settings" element={<Settings />} />
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
