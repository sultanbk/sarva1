import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  LayoutDashboard,
  Store,
  Plus,
  Settings,
  LogOut,
  Menu,
  X,
  UserRound,
  Shield
} from 'lucide-react'
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate
} from 'react-router-dom'
import {
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query'
import {
  clearToken,
  cn,
  getAdminName,
  getToken
} from './lib'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import CreateLicensePage from './pages/CreateLicensePage'
import SettingsPage from './pages/SettingsPage'
import { Button } from './components/ui'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute() {
  if (!getToken()) return <Navigate to="/login" replace />
  return <Outlet />
}

function AppShell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  
  const titles: Record<string, string> = {
    '/': 'System Metrics Dashboard',
    '/clients': 'Licensing Records',
    '/clients/new': 'Generate Client License',
    '/settings': 'Console Configuration',
  }
  
  const title = location.pathname.startsWith('/clients/') && location.pathname !== '/clients/new' 
    ? 'Telemetry dossier' 
    : titles[location.pathname] || 'Sarva One'

  function logout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 grid-bg">
      {/* Sidebar Navigation */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-72 bg-brand-dark shadow-2xl transition-transform duration-300 border-r border-white/5 lg:translate-x-0 flex flex-col',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Sidebar Header Branding */}
        <div className="flex h-18 items-center gap-3.5 border-b border-white/5 px-6 bg-brand-dark/20">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
            <img 
              src="/logo.png" 
              alt="Sarva One Logo" 
              className="h-full w-full object-contain filter brightness-110"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const sib = e.currentTarget.nextElementSibling as HTMLElement;
                if (sib) sib.style.display = 'block';
              }}
            />
            <Shield className="hidden h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-display text-sm font-black tracking-tight text-white leading-tight">Sarva One</p>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider leading-none mt-0.5">License Admin</p>
          </div>
          <Button 
            className="ml-auto lg:hidden h-8 w-8 p-0 text-slate-400 border-white/10 hover:bg-white/5 hover:text-white" 
            variant="ghost" 
            onClick={() => setOpen(false)} 
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 space-y-1.5 p-4.5 overflow-y-auto">
          <SidebarLink to="/" icon={<LayoutDashboard />} label="Dashboard" onClick={() => setOpen(false)} />
          <SidebarLink to="/clients" icon={<Store />} label="Clients List" onClick={() => setOpen(false)} />
          <SidebarLink to="/clients/new" icon={<Plus />} label="Generate Key" onClick={() => setOpen(false)} />
          <SidebarLink to="/settings" icon={<Settings />} label="Console Config" onClick={() => setOpen(false)} />
        </nav>

        {/* Sidebar Footer Admin Profile & Actions */}
        <div className="border-t border-white/5 p-4.5 bg-brand-dark/15 flex flex-col gap-2.5">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 ring-1 ring-white/10">
              <UserRound className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white leading-tight">{getAdminName()}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none mt-0.5">Active Admin</p>
            </div>
          </div>
          <Button 
            className="w-full justify-start text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 cursor-pointer" 
            variant="ghost" 
            onClick={logout}
          >
            <LogOut className="h-4 w-4 text-rose-500" /> Logout Session
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar overlay backdrop */}
      {open && (
        <button 
          aria-label="Close menu" 
          className="fixed inset-0 z-30 bg-brand-dark/40 backdrop-blur-sm lg:hidden transition-opacity cursor-default" 
          onClick={() => setOpen(false)} 
        />
      )}

      {/* Main App Page Wrapper */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Main Sticky Header */}
        <header className="sticky top-0 z-20 flex h-18 items-center gap-4 border-b border-slate-100 bg-white/80 px-5 backdrop-blur-md lg:px-8 shadow-sm">
          <Button 
            variant="ghost" 
            className="lg:hidden h-9 w-9 p-0 border border-slate-200 text-slate-600 hover:bg-slate-50" 
            onClick={() => setOpen(true)} 
            aria-label="Open menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </Button>
          
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-black tracking-tight text-brand-dark">
            {title}
          </h1>

          <div className="hidden items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2 text-xs font-bold text-slate-500 sm:flex">
            <UserRound className="h-3.5 w-3.5 text-slate-400" /> Account: {getAdminName()}
          </div>
          
          <Button 
            variant="secondary" 
            size="sm" 
            className="hidden sm:inline-flex" 
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5 text-rose-600" /> Sign out
          </Button>
        </header>

        {/* Main Outlet Page Content */}
        <main className="flex-1 p-5 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarLink({ 
  to, 
  icon, 
  label, 
  onClick 
}: { 
  to: string; 
  icon: ReactNode; 
  label: string; 
  onClick: () => void 
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3.5 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 [&_svg]:h-4.5 [&_svg]:w-4.5',
          isActive 
            ? 'bg-gradient-to-r from-brand-primary/20 to-brand-secondary/15 text-white ring-1 ring-white/10 sidebar-active-glow' 
            : 'text-slate-400 hover:bg-white/5 hover:text-white'
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/new" element={<CreateLicensePage />} />
            <Route path="clients/:id" element={<ClientDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  )
}
