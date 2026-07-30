import type { ReactNode } from 'react'
import { CalendarClock, CheckCircle2, Clipboard, Globe, RefreshCcw, ShieldCheck, Store, UserCheck, Zap, MessageCircle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts'
import { NavLink } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMutationToast } from '../hooks/useMutationToast'
import { api, formatDate, formatDateTime } from '../lib'
import type { Client } from '../lib'
import { Card, CardHeader, LoadingState, ErrorState, EmptyState, Button } from '../components/ui'

const chartColors = ['#0048eb', '#0078f7', '#7c3aed', '#f59e0b', '#10b981']

export default function DashboardPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const qc = useQueryClient()
  
  const renew = useMutationToast({
    mutationFn: api.renew,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
    successMessage: 'License renewed successfully',
  })

  if (query.isLoading) return <LoadingState message="Retrieving licensing metrics" />
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />

  const data = query.data

  const stats = [
    { label: 'Total Clients', value: data.totalClients, icon: Store, color: 'text-blue-600 bg-blue-50/70 border-blue-100' },
    { label: 'Active Licenses', value: data.activeLicenses, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50/70 border-emerald-100' },
    { label: 'Reporting Clients', value: data.reportingClients, icon: Globe, color: 'text-violet-600 bg-violet-50/70 border-violet-100' },
    { label: 'Synced Today', value: data.clientsSyncedToday, icon: RefreshCcw, color: 'text-sky-600 bg-sky-50/70 border-sky-100' },
    { label: 'Bills Generated', value: data.totalBillsGenerated, icon: Zap, color: 'text-amber-600 bg-amber-50/70 border-amber-100' },
    { label: 'Bills Today', value: data.billsToday, icon: CalendarClock, color: 'text-orange-600 bg-orange-50/70 border-orange-100' },
    { label: 'Customers Logged', value: data.totalCustomersReported, icon: UserCheck, color: 'text-rose-600 bg-rose-50/70 border-rose-100' },
    { label: 'Products Cataloged', value: data.totalProductsReported, icon: Clipboard, color: 'text-indigo-600 bg-indigo-50/70 border-indigo-100' },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-brand-dark to-brand-dark-light p-6 text-white shadow-lg">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold tracking-tight">System Telemetry Overview</h2>
          <p className="text-xs font-medium text-slate-400">Monitoring real-time licensing transactions and heartbeats across installed clients.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4.5 py-2.5 text-sm font-semibold border border-white/10">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          Global System: Online
        </div>
      </div>

      {/* 4x2 Stats Grid */}
      <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="p-5.5 hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{stat.label}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${stat.color} shrink-0`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
              <p className="mt-3.5 font-display text-3xl font-black text-brand-dark tracking-tight">
                {typeof stat.value === 'number' && stat.label.includes('Generated') 
                  ? stat.value.toLocaleString()
                  : stat.value}
              </p>
            </Card>
          )
        })}
      </div>

      {/* Row 1: Graphical Insights */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* New Clients Area Chart */}
        <ChartCard title="New Clients Registration" description="Monthly registration growth trend">
          <AreaChart data={data.clientsPerMonth} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorClients" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0048eb" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#0048eb" stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip />
            <Area type="monotone" dataKey="clients" stroke="#0048eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClients)" />
          </AreaChart>
        </ChartCard>

        {/* Clients By Plan Donut Chart */}
        <ChartCard title="License Allocation" description="Clients distribution across service plans">
          <div className="flex h-full items-center justify-center">
            <div className="relative h-full w-full max-w-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={data.clientsByPlan} 
                    dataKey="count" 
                    nameKey="plan" 
                    innerRadius={60} 
                    outerRadius={85} 
                    paddingAngle={3}
                  >
                    {data.clientsByPlan.map((entry, index) => (
                      <Cell key={entry.plan} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Plans</span>
                <span className="font-display text-2xl font-black text-brand-dark">{data.totalClients}</span>
              </div>
            </div>
          </div>
        </ChartCard>

        {/* Daily Heartbeats Bar Chart */}
        <ChartCard title="Heartbeat Activity" description="Aggregated client sync pings (Last 7 Days)">
          <BarChart data={data.heartbeatsDaily} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="heartbeats" fill="#0078f7" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ChartCard>
      </div>

      {/* License Status & Revenue Breakdown */}
      <div className="grid gap-6 xl:grid-cols-4">
        <Card className="p-5.5 xl:col-span-2">
          <CardHeader title="License Status Overview" description="Current state distribution across all clients" />
          <div className="h-56 px-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[
                  { name: 'Active', value: data.activeLicenses, fill: '#10b981' },
                  { name: 'Expired', value: data.expiredLicenses, fill: '#ef4444' },
                  { name: 'Other', value: Math.max(0, data.totalClients - data.activeLicenses - data.expiredLicenses), fill: '#94a3b8' },
                ].filter(d => d.value > 0)} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={3}>
                  {['#10b981', '#ef4444', '#94a3b8'].map((color, i) => (<Cell key={i} fill={color} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 pb-4 text-xs">
            <span className="flex items-center gap-1.5 font-bold text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Active {data.activeLicenses}</span>
            <span className="flex items-center gap-1.5 font-bold text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Expired {data.expiredLicenses}</span>
            <span className="flex items-center gap-1.5 font-bold text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Other {Math.max(0, data.totalClients - data.activeLicenses - data.expiredLicenses)}</span>
          </div>
        </Card>

        <Card className="p-5.5">
          <CardHeader title="Sync Coverage" description="Clients reporting vs silent" />
          <div className="h-56 flex items-center justify-center">
            <div className="text-center">
              <p className="font-display text-5xl font-black text-brand-dark">{Math.round(data.reportingClients / data.totalClients * 100)}%</p>
              <p className="mt-2 text-xs font-bold text-slate-400">{data.reportingClients} of {data.totalClients} clients</p>
              <div className="mt-4 flex justify-center gap-1">
                <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${data.reportingClients / data.totalClients * 100}%`, maxWidth: 120 }} />
                <div className="h-3 rounded-full bg-slate-200" style={{ width: `${(data.totalClients - data.reportingClients) / data.totalClients * 100}%`, maxWidth: 40 }} />
              </div>
              <p className="mt-1 text-[10px] font-bold text-slate-400">{data.clientsNeverSynced || 0} never synced</p>
            </div>
          </div>
        </Card>

        <Card className="p-5.5">
          <CardHeader title="Daily Activity" description="Bills generated today" />
          <div className="h-56 flex items-center justify-center">
            <div className="text-center">
              <p className="font-display text-5xl font-black text-brand-dark">{data.billsToday.toLocaleString()}</p>
              <p className="mt-2 text-xs font-bold text-slate-400">bills generated today</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{data.totalBillsGenerated.toLocaleString()} total all-time</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3: Diagnostics & Usage */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Sync Health Status */}
        <ChartCard title="Sync Diagnostics" description="State distribution of last heartbeat checks">
          <BarChart data={data.clientSyncHealth} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="status" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="clients" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32}>
              {data.clientSyncHealth.map((entry, index) => (
                <Cell 
                  key={index} 
                  fill={entry.status.toLowerCase().includes('never') ? '#94a3b8' : entry.status.toLowerCase().includes('warning') || entry.status.toLowerCase().includes('grace') ? '#f59e0b' : entry.status.toLowerCase().includes('error') || entry.status.toLowerCase().includes('fail') ? '#ef4444' : '#10b981'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        {/* Top Active Clients */}
        <Card className="flex flex-col">
          <CardHeader title="Top Billing Clients" description="Client installations reporting highest bill generation" />
          <div className="flex-1 divide-y divide-slate-50 overflow-y-auto max-h-[288px]">
            {data.topBillClients.length ? (
              data.topBillClients.map((client) => (
                <NavLink 
                  key={client.id} 
                  to={`/clients/${client.id}`} 
                  className="flex items-center justify-between gap-4 p-4.5 transition hover:bg-slate-50/50 group"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800 group-hover:text-brand-primary transition">
                      {client.shopName}
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                      v{client.appVersion || 'Unknown'} · Sync {formatDateTime(client.lastHeartbeatAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-sm font-black text-brand-dark">{client.totalBills} bills</p>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                      {client.billsToday} today
                    </span>
                  </div>
                </NavLink>
              ))
            ) : (
              <div className="p-6"><EmptyState title="No usage telemetry reported yet" /></div>
            )}
          </div>
        </Card>

        {/* App Versions */}
        <Card className="flex flex-col">
          <CardHeader title="System Version Stats" description="Distribution of client engine releases" />
          <div className="flex-1 divide-y divide-slate-50 overflow-y-auto max-h-[288px]">
            {data.appVersions.length ? (
              data.appVersions.map((item) => (
                <div key={item.version} className="flex items-center justify-between p-4.5">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-slate-800">Release v{item.version}</p>
                    <p className="text-[11px] font-semibold text-slate-400">Active client terminals</p>
                  </div>
                  <span className="flex h-8 w-12 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-700">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6"><EmptyState title="No release version detected" /></div>
            )}
          </div>
        </Card>
      </div>

      {/* Row 4: Actionable Alert Lists */}
      <div className="grid gap-6 xl:grid-cols-3">
        <AlertList 
          title="Expiring Within 7 Days" 
          description="Action required to prevent service interruption"
          items={data.expiringSoon} 
          actionLabel="Renew License" 
          onAction={(id) => renew.mutate(id)} 
          isLoading={renew.isPending}
        />
        <AlertList 
          title="In Grace Period" 
          description="Exceeded standard term but access is active"
          items={data.graceLicenses} 
          actionLabel="Contact Admin" 
          contact 
        />
        <AlertList 
          title="Offline Installations (48h+)" 
          description="Terminals failing to report heartbeats"
          items={data.inactiveClients} 
          actionLabel="Contact Owner" 
          contact 
        />
      </div>
    </div>
  )
}

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} />
      <div className="h-72 px-6 pb-6 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function AlertList({
  title,
  description,
  items,
  actionLabel,
  contact,
  isLoading,
  onAction,
}: {
  title: string
  description?: string
  items: Client[]
  actionLabel: string
  contact?: boolean
  isLoading?: boolean
  onAction?: (id: string) => void
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} description={description} />
      <div className="flex-1 divide-y divide-slate-50 overflow-y-auto max-h-[300px]">
        {items.length ? (
          items.map((client) => (
            <div key={client.id} className="flex items-center gap-4 p-4.5 justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{client.shopName}</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                  {client.phone} · Exp. {formatDate(client.expiresAt)}
                </p>
              </div>
              {contact ? (
                <a 
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition" 
                  href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> {actionLabel}
                </a>
              ) : (
                <Button 
                  size="sm" 
                  variant="secondary"
                  isLoading={isLoading} 
                  onClick={() => onAction?.(client.id)}
                >
                  {actionLabel}
                </Button>
              )}
            </div>
          ))
        ) : (
          <div className="p-6">
            <EmptyState title="Nothing needs attention" icon={<ShieldCheck className="h-10 w-10 text-emerald-500" />} />
          </div>
        )}
      </div>
    </Card>
  )
}
