import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity,
  ArrowUpDown,
  BadgeIndianRupee,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Copy,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  API_URL,
  LICENSE_API_PREFIX,
  LICENSE_ENDPOINTS,
  TOKEN_KEY,
  api,
  clearToken,
  cn,
  copyText,
  formatCurrency,
  formatDate,
  formatDateTime,
  getAdminName,
  getToken,
  setToken,
} from './lib'
import type { Client, ClientDetail, LicenseStatus, Plan } from './lib'

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

const planColors: Record<Plan, string> = {
  starter: 'bg-slate-100 text-slate-700 ring-slate-200',
  growth: 'bg-sky-100 text-sky-700 ring-sky-200',
  pro: 'bg-violet-100 text-violet-700 ring-violet-200',
  custom: 'bg-amber-100 text-amber-800 ring-amber-200',
}

const statusColors: Record<LicenseStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  trial: 'bg-blue-100 text-blue-700 ring-blue-200',
  grace: 'bg-orange-100 text-orange-700 ring-orange-200',
  expired: 'bg-rose-100 text-rose-700 ring-rose-200',
  suspended: 'bg-red-950 text-red-100 ring-red-900',
}

const chartColors = ['#2563eb', '#7c3aed', '#f59e0b', '#10b981']

function Button({
  children,
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  return (
    <button
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60',
        variant === 'primary' && 'bg-slate-950 text-white shadow-sm hover:bg-slate-800 focus-visible:outline-slate-950',
        variant === 'secondary' && 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-slate-400',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-slate-400',
        variant === 'danger' && 'bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100',
        props.className,
      )}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100',
        props.className,
      )}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100',
        props.className,
      )}
    />
  )
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>{children}</section>
}

function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

function PlanBadge({ plan }: { plan: Plan }) {
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1', planColors[plan])}>{plan}</span>
}

function StatusBadge({ status }: { status: LicenseStatus }) {
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1', statusColors[status])}>{status}</span>
}

function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      {children ? <p className="mt-1 max-w-md text-sm text-slate-500">{children}</p> : null}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-64 items-center justify-center text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading dashboard data
    </div>
  )
}

function ErrorState({ retry }: { retry: () => void }) {
  return (
    <EmptyState title="Unable to load data">
      <span className="mb-4 block">Check the API server and try again.</span>
      <Button type="button" variant="secondary" onClick={retry}>
        <RefreshCcw className="h-4 w-4" /> Retry
      </Button>
    </EmptyState>
  )
}

function ProtectedRoute() {
  if (!getToken()) return <Navigate to="/login" replace />
  return <Outlet />
}

function AppShell() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const titles: Record<string, string> = {
    '/': 'Dashboard',
    '/clients': 'Clients',
    '/clients/new': 'Create License',
    '/settings': 'Settings',
  }
  const title = location.pathname.startsWith('/clients/') && location.pathname !== '/clients/new' ? 'Client Detail' : titles[location.pathname] || 'Sarva One'

  function logout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className={cn('fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">Sarva One</p>
            <p className="text-xs text-slate-500">License Admin</p>
          </div>
          <Button className="ml-auto lg:hidden" variant="ghost" onClick={() => setOpen(false)} aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="space-y-1 p-3">
          <SidebarLink to="/" icon={<LayoutDashboard />} label="Dashboard" onClick={() => setOpen(false)} />
          <SidebarLink to="/clients" icon={<Store />} label="Clients" onClick={() => setOpen(false)} />
          <SidebarLink to="/clients/new" icon={<Plus />} label="Create License" onClick={() => setOpen(false)} />
          <SidebarLink to="/settings" icon={<Settings />} label="Settings" onClick={() => setOpen(false)} />
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-slate-100 p-3">
          <Button className="w-full justify-start" variant="ghost" onClick={logout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>
      {open ? <button aria-label="Close menu" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setOpen(false)} /> : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <Button variant="ghost" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
          <div className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
            <UserRound className="h-4 w-4" /> {getAdminName()}
          </div>
          <Button variant="secondary" onClick={logout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </header>
        <main className="mx-auto max-w-7xl p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarLink({ to, icon, label, onClick }: { to: string; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition [&_svg]:h-4 [&_svg]:w-4', isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950')
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'setup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const mutation = useMutation({
    mutationFn: () => (mode === 'login' ? api.login(email, password) : api.setup({ name, email, password })),
    onSuccess: (data) => {
      setToken(data.token)
      navigate('/', { replace: true })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  if (getToken()) return <Navigate to="/" replace />

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-white">
        <div className="p-7">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Sarva One Admin</h1>
              <p className="text-sm text-slate-500">{mode === 'login' ? 'Sign in to manage licenses' : 'Create the first admin account'}</p>
            </div>
          </div>
          <form className="space-y-4" onSubmit={submit}>
            {mode === 'setup' ? (
              <label className="block text-sm font-semibold">
                Name
                <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
              </label>
            ) : null}
            <label className="block text-sm font-semibold">
              Email
              <Input className="mt-1.5" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <Input className="mt-1.5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </label>
            {mutation.isError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{mutation.error.message}</p> : null}
            <Button className="w-full" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {mode === 'login' ? 'Login' : 'Create Admin'}
            </Button>
            <Button className="w-full" type="button" variant="ghost" onClick={() => setMode(mode === 'login' ? 'setup' : 'login')}>
              {mode === 'login' ? 'Run first-time setup' : 'Back to login'}
            </Button>
          </form>
        </div>
      </Card>
    </main>
  )
}

function DashboardPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const qc = useQueryClient()
  const renew = useMutation({
    mutationFn: api.renew,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />

  const stats = [
    { label: 'Total Clients', value: query.data.totalClients, icon: Store },
    { label: 'Active Licenses', value: query.data.activeLicenses, icon: CheckCircle2 },
    { label: 'Reporting Clients', value: query.data.reportingClients, icon: Activity },
    { label: 'Synced Today', value: query.data.clientsSyncedToday, icon: RefreshCcw },
    { label: 'Bills Generated', value: query.data.totalBillsGenerated, icon: Activity },
    { label: 'Bills Today', value: query.data.billsToday, icon: CalendarClock },
    { label: 'Customers Reported', value: query.data.totalCustomersReported, icon: UserRound },
    { label: 'Products Reported', value: query.data.totalProductsReported, icon: Gauge },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <stat.icon className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-3 text-2xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="New Clients" className="xl:col-span-1">
          <LineChart data={query.data.clientsPerMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="clients" stroke="#0f172a" strokeWidth={3} dot={false} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Clients By Plan">
          <PieChart>
            <Pie data={query.data.clientsByPlan} dataKey="count" nameKey="plan" innerRadius={55} outerRadius={88} paddingAngle={4}>
              {query.data.clientsByPlan.map((entry, index) => <Cell key={entry.plan} fill={chartColors[index % chartColors.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ChartCard>
        <ChartCard title="Daily Heartbeats">
          <BarChart data={query.data.heartbeatsDaily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="heartbeats" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="Sync Health">
          <BarChart data={query.data.clientSyncHealth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="status" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="clients" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <TopBillClientsCard items={query.data.topBillClients} />
        <AppVersionsCard items={query.data.appVersions} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <AlertList title="Expiring Next 7 Days" items={query.data.expiringSoon} actionLabel="Renew" onAction={(id) => renew.mutate(id)} />
        <AlertList title="Grace Period" items={query.data.graceLicenses} actionLabel="Contact" contact />
        <AlertList title="No Heartbeat 48h" items={query.data.inactiveClients} actionLabel="Contact" contact />
      </div>
    </div>
  )
}

function TopBillClientsCard({ items }: { items: Array<{ id: string; shopName: string; phone: string; totalBills: number; billsToday: number; lastHeartbeatAt?: string | null; appVersion?: string | null }> }) {
  return (
    <Card>
      <CardHeader title="Top Bill Clients" />
      <div className="divide-y divide-slate-100">
        {items.length ? items.map((client) => (
          <NavLink key={client.id} to={`/clients/${client.id}`} className="block p-4 transition hover:bg-slate-50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{client.shopName}</p>
                <p className="mt-1 text-xs text-slate-500">{client.phone} | Last sync {formatDateTime(client.lastHeartbeatAt)}</p>
                <p className="mt-1 text-xs text-slate-500">v{client.appVersion || 'Unknown'}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-slate-950">{client.totalBills}</p>
                <p className="text-xs text-slate-500">{client.billsToday} today</p>
              </div>
            </div>
          </NavLink>
        )) : <div className="p-4"><EmptyState title="No usage reported yet" /></div>}
      </div>
    </Card>
  )
}

function AppVersionsCard({ items }: { items: Array<{ version: string; count: number }> }) {
  return (
    <Card>
      <CardHeader title="App Versions" />
      <div className="divide-y divide-slate-100">
        {items.length ? items.map((item) => (
          <div key={item.version} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">v{item.version}</p>
              <p className="text-xs text-slate-500">Installed clients</p>
            </div>
            <p className="text-lg font-bold">{item.count}</p>
          </div>
        )) : <div className="p-4"><EmptyState title="No versions reported yet" /></div>}
      </div>
    </Card>
  )
}

function ChartCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} />
      <div className="h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function AlertList({ title, items, actionLabel, contact, onAction }: { title: string; items: Client[]; actionLabel: string; contact?: boolean; onAction?: (id: string) => void }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="divide-y divide-slate-100">
        {items.length ? items.map((client) => (
          <div key={client.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{client.shopName}</p>
              <p className="text-xs text-slate-500">{client.phone} · Expires {formatDate(client.expiresAt)}</p>
            </div>
            {contact ? (
              <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold" href={`https://wa.me/${client.phone}`}>
                <MessageCircle className="h-4 w-4" /> {actionLabel}
              </a>
            ) : (
              <Button variant="secondary" onClick={() => onAction?.(client.id)}><CalendarClock className="h-4 w-4" /> {actionLabel}</Button>
            )}
          </div>
        )) : <div className="p-4"><EmptyState title="Nothing needs attention" /></div>}
      </div>
    </Card>
  )
}

function ClientsPage() {
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('shopName')
  const params = new URLSearchParams()
  params.set('pageSize', '100')
  if (search) params.set('q', search)
  if (plan) params.set('plan', plan)
  if (status) params.set('status', status)
  if (sort) params.set('sort', sort)

  const query = useQuery({ queryKey: ['clients', params.toString()], queryFn: () => api.clients(params.toString()) })
  const qc = useQueryClient()
  const clientAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'reactivate' | 'reset' }) =>
      action === 'suspend' ? api.suspend(id) : action === 'reactivate' ? api.reactivate(id) : api.resetMachine(id),
    onMutate: async ({ id, action }) => {
      await qc.cancelQueries({ queryKey: ['clients'] })
      const previous = qc.getQueryData<Client[]>(['clients', params.toString()])
      if (action !== 'reset') {
        qc.setQueryData<Client[]>(['clients', params.toString()], (old) => old?.map((client) => client.id === id ? { ...client, status: action === 'suspend' ? 'suspended' : 'active' } : client))
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(['clients', params.toString()], context.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search shop, owner, phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">All plans</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
            <option value="custom">Custom</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="shopName">Sort: Shop</option>
            <option value="ownerName">Sort: Owner</option>
            <option value="plan">Sort: Plan</option>
            <option value="status">Sort: Status</option>
            <option value="expiresAt">Sort: Expires</option>
            <option value="lastHeartbeatAt">Sort: Heartbeat</option>
          </Select>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                {['Shop Name', 'Owner Name', 'Phone', 'Plan', 'Status', 'Activated Date', 'Expires Date', 'Last Heartbeat', 'Actions'].map((head) => (
                  <th key={head} className="px-4 py-3 font-bold">{head} {head !== 'Actions' ? <ArrowUpDown className="inline h-3.5 w-3.5" /> : null}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.data.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold">{client.shopName}</td>
                  <td className="px-4 py-3">{client.ownerName}</td>
                  <td className="px-4 py-3">{client.phone}</td>
                  <td className="px-4 py-3"><PlanBadge plan={client.plan} /></td>
                  <td className="px-4 py-3"><StatusBadge status={client.status} /></td>
                  <td className="px-4 py-3">{formatDate(client.activatedAt)}</td>
                  <td className="px-4 py-3">{formatDate(client.expiresAt)}</td>
                  <td className="px-4 py-3">{formatDateTime(client.lastHeartbeatAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <NavLink className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 font-semibold" to={`/clients/${client.id}`}>View</NavLink>
                      <Button variant="secondary" onClick={() => copyText(client.licenseKey)}><Copy className="h-4 w-4" /></Button>
                      <Button variant="secondary" onClick={() => { if (client.status === 'suspended' || window.confirm(`Suspend license for ${client.shopName}?`)) clientAction.mutate({ id: client.id, action: client.status === 'suspended' ? 'reactivate' : 'suspend' }) }}>
                        {client.status === 'suspended' ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                      <Button variant="secondary" onClick={() => { if (window.confirm(`Reset machine binding for ${client.shopName}?`)) clientAction.mutate({ id: client.id, action: 'reset' }) }}><RefreshCcw className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['client', id], queryFn: () => api.client(id), enabled: Boolean(id) })
  const update = useMutation({
    mutationFn: (payload: Partial<ClientDetail>) => api.updateClient(id, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ['client', id] })
      const previous = qc.getQueryData<ClientDetail>(['client', id])
      qc.setQueryData<ClientDetail>(['client', id], (old) => old ? { ...old, ...payload } : old)
      return { previous }
    },
    onError: (_error, _vars, context) => context?.previous && qc.setQueryData(['client', id], context.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ['client', id] }),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/clients')
    },
  })
  const reset = useMutation({
    mutationFn: () => api.resetMachine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
  const deactivateMachine = useMutation({
    mutationFn: (activationId: string) => api.deactivateMachine(id, activationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const blockMachine = useMutation({
    mutationFn: (activationId: string) => api.blockMachine(id, activationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const unblockMachine = useMutation({
    mutationFn: (activationId: string) => api.unblockMachine(id, activationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const reactivate = useMutation({
    mutationFn: () => api.reactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const renew = useMutation({
    mutationFn: () => api.renew(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />

  const client = query.data

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="License Info" action={<><PlanBadge plan={client.plan} /> <StatusBadge status={client.status} /></>} />
          <InfoRows rows={[
            ['License Key', client.licenseKey],
            ['Seats', `${client.activations.filter((activation) => !activation.deactivatedAt).length} / ${client.maxSeats ?? 1}`],
            ['Activated', formatDate(client.activatedAt)],
            ['Expires', formatDate(client.expiresAt)],
          ]} />
        </Card>
        <Card>
          <CardHeader title="Shop Info" />
          <InfoRows rows={[
            ['Shop', client.shopName],
            ['Owner', client.ownerName],
            ['Phone', client.phone],
            ['Email', client.email || 'Not added'],
          ]} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (window.confirm(`Suspend license for ${client.shopName}? The shop will lose access immediately.`)) {
                  update.mutate({ status: 'suspended' })
                }
              }}
              disabled={update.isPending}
            >
              <Ban className="h-4 w-4" /> Suspend
            </Button>
            <Button
              variant="secondary"
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
            >
              {reactivate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reactivate
            </Button>
            <Button
              variant="secondary"
              onClick={() => renew.mutate()}
              disabled={renew.isPending}
            >
              {renew.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Renew (+30 Days)
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (window.confirm(`Reset machine binding for ${client.shopName}? They will need to re-activate.`)) {
                  reset.mutate()
                }
              }}
              disabled={reset.isPending}
            >
              {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Reset Machine
            </Button>
            <label className="block text-sm font-semibold sm:col-span-2">
              Update Plan
              <Select
                className="mt-1"
                value={client.plan}
                onChange={(e) => update.mutate({ plan: e.target.value as Plan })}
                disabled={update.isPending}
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="pro">Pro</option>
                <option value="custom">Custom</option>
              </Select>
            </label>
            <label className="block text-sm font-semibold sm:col-span-2">
              Max Seats
              <Input
                className="mt-1"
                type="number"
                min="1"
                max="99"
                value={client.maxSeats ?? 1}
                onChange={(e) => update.mutate({ maxSeats: Number(e.target.value || 1) })}
                disabled={update.isPending}
              />
            </label>
            <label className="block text-sm font-semibold sm:col-span-2">
              Custom Expiry Date
              <Input
                className="mt-1"
                type="date"
                value={client.expiresAt ? new Date(client.expiresAt).toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    update.mutate({ expiresAt: new Date(e.target.value).toISOString() })
                  }
                }}
                disabled={update.isPending}
              />
            </label>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-base font-semibold">Notes</h2>
          <Textarea defaultValue={client.notes} onBlur={(e) => update.mutate({ notes: e.target.value })} placeholder="Add internal notes" />
        </Card>
        <Card className="border-red-200 p-5">
          <h2 className="text-base font-semibold text-red-900">Danger Zone</h2>
          <p className="mt-1 text-sm text-red-700">Archive this license. It will be hidden from active lists but retained for support history.</p>
          {remove.isError ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{remove.error.message}</p> : null}
          <Button className="mt-4" variant="danger" onClick={() => { if (window.confirm(`Archive the license for ${client.shopName}? It will be hidden from active license lists.`)) remove.mutate() }} disabled={remove.isPending}><Trash2 className="h-4 w-4" /> Archive License</Button>
        </Card>
      </div>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Bills" value={client.totalBillsGenerated} />
          <MiniStat label="Customers" value={client.totalCustomers} />
          <MiniStat label="Products" value={client.totalProducts} />
          <MiniStat label="Version" value={client.appVersion || 'Unknown'} />
        </div>
        <ChartCard title="Bills Generated">
          <LineChart data={client.billsSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="bills" stroke="#2563eb" strokeWidth={3} dot={false} />
          </LineChart>
        </ChartCard>
        {client.heartbeats?.[0]?.metadata ? (
          <Card>
            <CardHeader title="Client System Diagnostics" description="Hardware specifications and database health from latest sync" />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-500">Operating System</p>
                <p className="mt-1.5 text-sm font-bold text-slate-900 capitalize">
                  {client.heartbeats[0].metadata.osPlatform} {client.heartbeats[0].metadata.osRelease}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-500">CPU Model</p>
                <p className="mt-1.5 truncate text-sm font-bold text-slate-900" title={client.heartbeats[0].metadata.cpuModel}>
                  {client.heartbeats[0].metadata.cpuModel} ({client.heartbeats[0].metadata.cpuCores} Cores)
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-500">System Memory</p>
                <p className="mt-1.5 text-sm font-bold text-slate-900">
                  {client.heartbeats[0].metadata.freeMemoryGB} GB Free / {client.heartbeats[0].metadata.totalMemoryGB} GB Total
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-500">Timezone</p>
                <p className="mt-1.5 text-sm font-bold text-slate-900">{client.heartbeats[0].metadata.timezone}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-500">Local Database Size</p>
                <p className="mt-1.5 text-sm font-bold text-slate-900">{client.heartbeats[0].metadata.dbSizeMB} MB</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-semibold text-slate-500">Runtime Engine</p>
                <p className="mt-1.5 text-sm font-bold text-slate-900">
                  Electron {client.heartbeats[0].metadata.electronVersion} (Chrome {client.heartbeats[0].metadata.chromeVersion})
                </p>
              </div>
            </div>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Activated Machines" description="Active and historical machine seats" />
          <div className="divide-y divide-slate-100">
            {client.activations.map((activation) => (
              <div key={activation.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{activation.hostname || 'Unknown machine'}</p>
                  <p className="break-all text-xs text-slate-500">{activation.machineIdHash.slice(0, 16)}... | Last seen {formatDateTime(activation.lastSeenAt)} | v{activation.appVersion || 'Unknown'}</p>
                </div>
                {activation.blockedAt ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Blocked</span>
                    <Button
                      variant="secondary"
                      disabled={unblockMachine.isPending}
                      onClick={() => {
                        if (window.confirm(`Unblock this machine for ${client.shopName}?`)) {
                          unblockMachine.mutate(activation.id)
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4" /> Unblock
                    </Button>
                  </div>
                ) : activation.deactivatedAt ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Deactivated</span>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={deactivateMachine.isPending}
                      onClick={() => {
                        if (window.confirm(`Deactivate this machine for ${client.shopName}?`)) {
                          deactivateMachine.mutate(activation.id)
                        }
                      }}
                    >
                      <Ban className="h-4 w-4" /> Deactivate
                    </Button>
                    <Button
                      variant="danger"
                      disabled={blockMachine.isPending}
                      onClick={() => {
                        if (window.confirm(`Block this machine for ${client.shopName}? This will prevent this device from using or re-activating this license.`)) {
                          blockMachine.mutate(activation.id)
                        }
                      }}
                    >
                      <Ban className="h-4 w-4" /> Block
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {!client.activations.length ? <div className="p-4"><EmptyState title="No machines activated yet" /></div> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment History" description="Recorded payment and renewal events" />
          <div className="divide-y divide-slate-100">
            {client.payments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-3 p-4">
                <BadgeIndianRupee className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold">{formatCurrency(payment.amount)} {payment.status}</p>
                  <p className="text-sm text-slate-500">{payment.provider} | {formatDateTime(payment.createdAt)}</p>
                </div>
              </div>
            ))}
            {!client.payments.length ? <div className="p-4"><EmptyState title="No payments recorded yet" /></div> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Activity Timeline" description="Last 10 heartbeats" />
          <div className="divide-y divide-slate-100">
            {client.heartbeats?.slice(0, 10).map((beat) => (
              <div key={beat.id} className="flex gap-3 p-4">
                <Activity className="mt-1 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold">{formatDateTime(beat.timestamp)}</p>
                  <p className="text-sm text-slate-500">{beat.billsGenerated} bills · {beat.customers} customers · {beat.products} products · v{beat.appVersion}</p>
                </div>
              </div>
            ))}
            {!client.heartbeats?.length ? <div className="p-4"><EmptyState title="No heartbeats yet" /></div> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Audit Timeline" description="Recent license and admin events" />
          <div className="divide-y divide-slate-100">
            {client.events?.slice(0, 12).map((event) => (
              <div key={event.id} className="flex gap-3 p-4">
                <ShieldCheck className="mt-1 h-4 w-4 text-blue-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{event.eventType.replaceAll('.', ' ')}</p>
                  <p className="text-sm text-slate-500">
                    {formatDateTime(event.timestamp)} | {event.actorType}{event.actorId ? ` | ${event.actorId}` : ''}{event.ipAddress ? ` | ${event.ipAddress}` : ''}
                  </p>
                </div>
              </div>
            ))}
            {!client.events?.length ? <div className="p-4"><EmptyState title="No audit events yet" /></div> : null}
          </div>
        </Card>
      </div>
    </div>
  )
}

function InfoRows({ rows }: { rows: Array<[string, string]> }) {
  return <div className="divide-y divide-slate-100">{rows.map(([label, value]) => <div key={label} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[130px_1fr]"><span className="font-semibold text-slate-500">{label}</span><span className="break-all text-slate-900">{value}</span></div>)}</div>
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return <Card className="p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></Card>
}

function CreateLicensePage() {
  const [created, setCreated] = useState<Client | null>(null)
  const mutation = useMutation({ mutationFn: api.createClient, onSuccess: setCreated })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutation.mutate({
      shopName: String(form.get('shopName')),
      ownerName: String(form.get('ownerName')),
      phone: String(form.get('phone')),
      email: String(form.get('email')),
      plan: String(form.get('plan')) as Plan,
      duration: String(form.get('duration')),
      customExpiry: String(form.get('customExpiry') || ''),
      gracePeriodDays: Number(form.get('gracePeriodDays') || 7),
      maxSeats: Number(form.get('maxSeats') || 1),
      notes: String(form.get('notes') || ''),
    })
  }

  const message = created ? encodeURIComponent(`Welcome to Sarva One! Your license key is: ${created.licenseKey}
Download link: [link]
Setup guide: [link]
Support: [whatsapp number]`) : ''

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card>
        <CardHeader title="Create License" description="Generate a new license for a Sarva One Billing client." />
        <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={submit}>
          <label className="text-sm font-semibold">Shop Name<Input className="mt-1.5" name="shopName" required /></label>
          <label className="text-sm font-semibold">Owner Name<Input className="mt-1.5" name="ownerName" required /></label>
          <label className="text-sm font-semibold">Phone<Input className="mt-1.5" name="phone" required /></label>
          <label className="text-sm font-semibold">Email<Input className="mt-1.5" name="email" type="email" required /></label>
          <label className="text-sm font-semibold">Plan<Select className="mt-1.5" name="plan" defaultValue="starter"><option value="starter">Starter</option><option value="growth">Growth</option><option value="pro">Pro</option><option value="custom">Custom</option></Select></label>
          <label className="text-sm font-semibold">Duration<Select className="mt-1.5" name="duration" defaultValue="1month"><option value="1month">1 month</option><option value="3months">3 months</option><option value="6months">6 months</option><option value="1year">1 year</option><option value="custom">Custom date</option></Select></label>
          <label className="text-sm font-semibold">Custom Expiry<Input className="mt-1.5" name="customExpiry" type="date" /></label>
          <label className="text-sm font-semibold">Grace Period Days<Input className="mt-1.5" name="gracePeriodDays" type="number" min="0" defaultValue={7} /></label>
          <label className="text-sm font-semibold">Max Seats<Input className="mt-1.5" name="maxSeats" type="number" min="1" max="99" defaultValue={1} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Notes<Textarea className="mt-1.5" name="notes" /></label>
          {mutation.isError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{mutation.error.message}</p> : null}
          <Button className="sm:col-span-2" disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create License</Button>
        </form>
      </Card>
      <Card className="p-5">
        <h2 className="text-base font-semibold">Generated License Key</h2>
        {created ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="break-all font-mono text-lg font-bold">{created.licenseKey}</p>
              <p className="mt-2 text-sm text-slate-500">{created.shopName} · {created.phone}</p>
            </div>
            <Button className="w-full" variant="secondary" onClick={() => copyText(created.licenseKey)}><Clipboard className="h-4 w-4" /> Copy Key</Button>
            <a className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white" href={`https://wa.me/${created.phone}?text=${message}`} target="_blank">
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </a>
          </div>
        ) : <EmptyState title="No key generated yet">Submit the form to create a license.</EmptyState>}
      </Card>
    </div>
  )
}

function SettingsPage() {
  const status = useQuery({ queryKey: ['server-status'], queryFn: api.serverStatus })
  const key = useQuery({ queryKey: ['api-key'], queryFn: api.apiKey })
  const password = useMutation({ mutationFn: api.changePassword })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    password.mutate({
      currentPassword: String(form.get('currentPassword')),
      newPassword: String(form.get('newPassword')),
    })
    event.currentTarget.reset()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Change Admin Password" />
        <form className="space-y-4 p-5" onSubmit={submit}>
          <label className="block text-sm font-semibold">Current Password<Input className="mt-1.5" type="password" name="currentPassword" required /></label>
          <label className="block text-sm font-semibold">New Password<Input className="mt-1.5" type="password" name="newPassword" minLength={10} required /></label>
          {password.isSuccess ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Password updated.</p> : null}
          {password.isError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{password.error.message}</p> : null}
          <Button disabled={password.isPending}><Save className="h-4 w-4" /> Save Password</Button>
        </form>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="API Key" description="Used by Sarva One Billing app configuration." />
          <div className="p-5">
            <code className="block overflow-x-auto rounded-md bg-slate-950 p-4 text-sm text-white">
              {key.isLoading ? 'Loading...' : key.data?.apiKey || 'Not configured'}
            </code>
          </div>
        </Card>
        <Card>
          <CardHeader title="Billing App Endpoints" description="Protected by API key rate limits in the license router." />
          <div className="divide-y divide-slate-100">
            {LICENSE_ENDPOINTS.map((endpoint) => {
              const url = `${API_URL}${LICENSE_API_PREFIX}${endpoint.path}`
              return (
                <div key={endpoint.path} className="grid gap-2 p-4 text-sm sm:grid-cols-[150px_1fr_auto] sm:items-center">
                  <div>
                    <p className="font-semibold text-slate-900">{endpoint.label}</p>
                    <p className="text-xs font-bold text-blue-700">{endpoint.method}</p>
                  </div>
                  <code className="overflow-x-auto rounded-md bg-slate-100 px-2.5 py-2 text-xs text-slate-800">{url}</code>
                  <Button variant="secondary" onClick={() => copyText(url)}>
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                </div>
              )
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Server Status" action={<Button variant="secondary" onClick={() => status.refetch()}><RefreshCcw className="h-4 w-4" /> Check</Button>} />
          <div className="space-y-2 p-5 text-sm">
            <p><span className="font-semibold">Base URL:</span> {API_URL}</p>
            <p><span className="font-semibold">Token key:</span> {TOKEN_KEY}</p>
            <p><span className="font-semibold">Status:</span> {status.isLoading ? 'Checking...' : status.data?.status || (status.isError ? 'Unavailable' : 'Unknown')}</p>
          </div>
        </Card>
      </div>
    </div>
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
