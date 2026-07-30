import { useState, useEffect } from 'react'
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
  Shield,
  Activity,
  ChevronLeft,
  ChevronRight
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
import AuditLogPage from './pages/AuditLogPage'
import { Button } from './components/ui'
import { Breadcrumbs } from './components/Breadcrumbs'
import { CommandPalette } from './components/CommandPalette'
import { ToastProvider } from './components/Toast'

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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const toggleCollapse = () => setCollapsed((prev) => {
    const next = !prev
    localStorage.setItem('sidebarCollapsed', String(next))
    return next
  })

  /* Cmd+K / Ctrl+K global palette */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((p) => !p)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
  
  const titles: Record<string, string> = {
    '/': 'System Metrics Dashboard',
    '/clients': 'Licensing Records',
    '/clients/new': 'Generate Client License',
    '/settings': 'Console Configuration',
    '/audit-log': 'Audit Trail Logs',
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
        'fixed inset-y-0 left-0 z-40 bg-brand-dark shadow-2xl transition-all duration-300 border-r border-white/5 lg:translate-x-0 flex flex-col',
        collapsed ? 'w-20' : 'w-72',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Sidebar Header Branding */}
        <div className={cn('flex items-center gap-3.5 border-b border-white/5 bg-brand-dark/20 h-18', collapsed ? 'justify-center px-0' : 'px-6')}>
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 p-2 ring-1 ring-white/10 shrink-0">
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
          {!collapsed && (
            <>
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
            </>
          )}
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
          <SidebarLink to="/" icon={<LayoutDashboard />} label="Dashboard" collapsed={collapsed} onClick={() => setOpen(false)} />
          <SidebarLink to="/clients" icon={<Store />} label="Clients List" collapsed={collapsed} onClick={() => setOpen(false)} />
          <SidebarLink to="/clients/new" icon={<Plus />} label="Generate Key" collapsed={collapsed} onClick={() => setOpen(false)} />
          <SidebarLink to="/audit-log" icon={<Activity />} label="Audit Log" collapsed={collapsed} onClick={() => setOpen(false)} />
          <SidebarLink to="/settings" icon={<Settings />} label="Console Config" collapsed={collapsed} onClick={() => setOpen(false)} />
        </nav>

        {/* Sidebar Footer Admin Profile & Actions */}
        <div className="border-t border-white/5 p-3 bg-brand-dark/15 flex flex-col gap-2.5">
          {collapsed ? (
            <div className="flex justify-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 ring-1 ring-white/10">
                <UserRound className="h-4.5 w-4.5" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-300 ring-1 ring-white/10 shrink-0">
                <UserRound className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white leading-tight">{getAdminName()}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide leading-none mt-0.5">Active Admin</p>
              </div>
            </div>
          )}
          <Button
            className="w-full justify-start text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 cursor-pointer"
            variant="ghost"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 text-rose-500 shrink-0" /> {!collapsed && 'Logout Session'}
          </Button>
          {/* Collapse toggle */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex items-center justify-center w-full gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </button>
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
      <div className={cn('flex flex-col min-h-screen', collapsed ? 'lg:pl-20' : 'lg:pl-72')}>
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
          
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-black tracking-tight text-brand-dark flex items-center gap-3">
            <span>{title}</span>
            {import.meta.env.VITE_ENV_LABEL && import.meta.env.VITE_ENV_LABEL !== 'Production' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 animate-pulse uppercase tracking-wider leading-none">
                Staging: {import.meta.env.VITE_ENV_LABEL}
              </span>
            )}
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
          <Breadcrumbs />
          <div key={location.pathname} className="animate-pageEnter">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

function SidebarLink({
  to,
  icon,
  label,
  collapsed,
  onClick
}: {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed?: boolean;
  onClick: () => void
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 [&_svg]:h-4.5 [&_svg]:w-4.5',
          collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3',
          isActive
            ? 'bg-gradient-to-r from-brand-primary/20 to-brand-secondary/15 text-white ring-1 ring-white/10 sidebar-active-glow'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'
        )
      }
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="clients/new" element={<CreateLicensePage />} />
              <Route path="clients/:id" element={<ClientDetailPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="audit-log" element={<AuditLogPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </QueryClientProvider>
  )
}
