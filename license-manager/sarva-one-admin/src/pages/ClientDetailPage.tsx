import { useState } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, Ban, RotateCcw, CalendarClock, RefreshCcw, Copy, Trash2, 
  Cpu, HardDrive, CpuIcon, Layers, Laptop, ShieldCheck, 
  Activity, Info, Save, Clock, Check
} from 'lucide-react'
import { api, formatDate, formatDateTime, copyText } from '../lib'
import type { ClientDetail, Plan } from '../lib'
import { 
  Card, CardHeader, PlanBadge, StatusBadge, Button, 
  Input, Select, Textarea, LoadingState, ErrorState, EmptyState 
} from '../components/ui'
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'diagnostics' | 'devices' | 'history'>('overview')
  const [copiedKey, setCopiedKey] = useState(false)

  const query = useQuery({ 
    queryKey: ['client', id], 
    queryFn: () => api.client(id), 
    enabled: Boolean(id) 
  })

  const update = useMutation({
    mutationFn: (payload: Partial<ClientDetail>) => api.updateClient(id, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ['client', id] })
      const previous = qc.getQueryData<ClientDetail>(['client', id])
      qc.setQueryData<ClientDetail>(['client', id], (old) => (old ? { ...old, ...payload } : old))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['client', id], context.previous)
      }
    },
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
    },
  })

  const blockMachine = useMutation({
    mutationFn: (activationId: string) => api.blockMachine(id, activationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
  })

  const unblockMachine = useMutation({
    mutationFn: (activationId: string) => api.unblockMachine(id, activationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
  })

  const reactivate = useMutation({
    mutationFn: () => api.reactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
  })

  const renew = useMutation({
    mutationFn: () => api.renew(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
  })

  const handleCopyKey = (key: string) => {
    copyText(key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 1500)
  }

  if (query.isLoading) return <LoadingState message="Connecting to client endpoint" />
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />

  const client = query.data
  const latestHeartbeat = client.heartbeats?.[0]

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Back Button & Brief Profile */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <NavLink 
            to="/clients" 
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm text-slate-600"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </NavLink>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight text-brand-dark">{client.shopName}</h2>
              <PlanBadge plan={client.plan} />
              <StatusBadge status={client.status} />
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-1">Owner: {client.ownerName} · Phone: {client.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400">Terminal Version:</span>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">v{client.appVersion || 'Unknown'}</span>
        </div>
      </div>

      {/* Tabs Selector Navigation */}
      <div className="flex border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-bold tracking-tight transition outline-none ${
            activeTab === 'overview' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Layers className="h-4.5 w-4.5" /> Overview
        </button>
        <button 
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-bold tracking-tight transition outline-none ${
            activeTab === 'diagnostics' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Cpu className="h-4.5 w-4.5" /> Diagnostics Specs
        </button>
        <button 
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-bold tracking-tight transition outline-none ${
            activeTab === 'devices' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Laptop className="h-4.5 w-4.5" /> Active Seats
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-bold tracking-tight transition outline-none ${
            activeTab === 'history' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Clock className="h-4.5 w-4.5" /> Timelines & Logs
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Left Column: License & Shop Details, and Quick Actions */}
          <div className="space-y-6">
            {/* Info Cards */}
            <Card>
              <CardHeader title="License Key & Expiration" />
              <div className="divide-y divide-slate-50 px-6 py-1">
                <div className="grid grid-cols-[130px_1fr] py-3.5 items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">License Key</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-800 flex-1">
                      {client.licenseKey}
                    </code>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8 w-8 p-0" 
                      onClick={() => handleCopyKey(client.licenseKey)}
                    >
                      {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-[130px_1fr] py-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Seats</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {client.activations.filter(a => !a.deactivatedAt).length} used / {client.maxSeats ?? 1} total
                  </span>
                </div>
                <div className="grid grid-cols-[130px_1fr] py-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activation Date</span>
                  <span className="text-sm font-semibold text-slate-800">{formatDate(client.activatedAt)}</span>
                </div>
                <div className="grid grid-cols-[130px_1fr] py-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expiration Date</span>
                  <span className="text-sm font-semibold text-slate-800">{formatDate(client.expiresAt)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Shop Contact Record" />
              <div className="divide-y divide-slate-50 px-6 py-1">
                <div className="grid grid-cols-[130px_1fr] py-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shop Name</span>
                  <span className="text-sm font-semibold text-slate-800">{client.shopName}</span>
                </div>
                <div className="grid grid-cols-[130px_1fr] py-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Owner Name</span>
                  <span className="text-sm font-semibold text-slate-800">{client.ownerName}</span>
                </div>
                <div className="grid grid-cols-[130px_1fr] py-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Details</span>
                  <span className="text-sm font-semibold text-slate-800">{client.phone}</span>
                </div>
                <div className="grid grid-cols-[130px_1fr] py-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</span>
                  <span className="text-sm font-semibold text-slate-800">{client.email || 'No email provided'}</span>
                </div>
              </div>
            </Card>

            {/* Quick Actions Panel */}
            <Card>
              <CardHeader title="Administrative Controls" description="Direct operations on client licensing record" />
              <div className="p-6">
                <div className="grid gap-4.5 sm:grid-cols-2">
                  <Button 
                    variant="secondary" 
                    className="justify-start text-left cursor-pointer"
                    onClick={() => {
                      if (window.confirm(`Suspend license for ${client.shopName}? The shop will lose access immediately.`)) {
                        update.mutate({ status: 'suspended' })
                      }
                    }}
                    disabled={update.isPending}
                  >
                    <Ban className="h-4.5 w-4.5 text-rose-500" /> Suspend Client
                  </Button>

                  <Button 
                    variant="secondary" 
                    className="justify-start text-left cursor-pointer"
                    onClick={() => reactivate.mutate()}
                    isLoading={reactivate.isPending}
                  >
                    <RotateCcw className="h-4.5 w-4.5 text-emerald-500" /> Reactivate License
                  </Button>

                  <Button 
                    variant="secondary" 
                    className="justify-start text-left cursor-pointer"
                    onClick={() => renew.mutate()}
                    isLoading={renew.isPending}
                  >
                    <CalendarClock className="h-4.5 w-4.5 text-brand-primary" /> Renew License (+30d)
                  </Button>

                  <Button 
                    variant="secondary" 
                    className="justify-start text-left cursor-pointer"
                    onClick={() => {
                      if (window.confirm(`Reset machine binding for ${client.shopName}?`)) {
                        reset.mutate()
                      }
                    }}
                    isLoading={reset.isPending}
                  >
                    <RefreshCcw className="h-4.5 w-4.5 text-amber-500" /> Reset Device Binding
                  </Button>
                </div>

                <div className="mt-6 grid gap-4 border-t border-slate-50 pt-5 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Update Service Tier</label>
                    <Select
                      value={client.plan}
                      onChange={(e) => update.mutate({ plan: e.target.value as Plan })}
                      disabled={update.isPending}
                    >
                      <option value="starter">Starter</option>
                      <option value="growth">Growth</option>
                      <option value="pro">Pro</option>
                      <option value="custom">Custom</option>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Max Device Seats</label>
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={client.maxSeats ?? 1}
                      onChange={(e) => update.mutate({ maxSeats: Number(e.target.value || 1) })}
                      disabled={update.isPending}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Custom Expiry Date</label>
                    <Input
                      type="date"
                      value={client.expiresAt ? new Date(client.expiresAt).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          update.mutate({ expiresAt: new Date(e.target.value).toISOString() })
                        }
                      }}
                      disabled={update.isPending}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Usage Stats, Chart, Internal Notes, Danger Zone */}
          <div className="space-y-6">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bills Total</span>
                <p className="mt-1 font-display text-lg font-black text-brand-dark">{client.totalBillsGenerated}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customers</span>
                <p className="mt-1 font-display text-lg font-black text-brand-dark">{client.totalCustomers}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Products</span>
                <p className="mt-1 font-display text-lg font-black text-brand-dark">{client.totalProducts}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bills Today</span>
                <p className="mt-1 font-display text-lg font-black text-emerald-600">{client.billsToday}</p>
              </div>
            </div>

            {/* Bill Activity Chart */}
            <Card>
              <CardHeader title="Client Billing Volume" description="Pings showing cumulative generated bills over time" />
              <div className="h-64 px-6 pb-6 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={client.billsSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="bills" stroke="#0048eb" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Internal Notes Card */}
            <Card>
              <CardHeader title="Administrative Notes" description="Internal remarks regarding client account history" />
              <div className="p-6">
                <div className="relative">
                  <Textarea
                    defaultValue={client.notes}
                    onBlur={(e) => update.mutate({ notes: e.target.value })}
                    placeholder="Enter account remarks here... (auto-saves on blur)"
                  />
                  <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <Save className="h-3 w-3" /> Auto-saves
                  </div>
                </div>
              </div>
            </Card>

            {/* Danger Zone Card */}
            <Card className="border-rose-100 hover:shadow-rose-100/50">
              <CardHeader 
                title="Decommissioning Zone" 
                description="Permanent operations on active client license" 
                className="border-rose-50"
              />
              <div className="p-6">
                <p className="text-xs font-semibold text-slate-400">
                  Archiving this license record hides it from the default console lists while retaining data history for legal compliance.
                </p>
                {remove.isError && (
                  <p className="mt-3 rounded-lg bg-rose-50 border border-rose-100 p-3 text-xs font-semibold text-rose-600">
                    {remove.error.message}
                  </p>
                )}
                <Button 
                  variant="danger" 
                  className="mt-4 font-bold text-xs" 
                  isLoading={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Archive client license for ${client.shopName}?`)) {
                      remove.mutate()
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Decommission & Archive License
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          {latestHeartbeat?.metadata ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 p-4.5 text-xs text-slate-500">
                <Info className="h-4.5 w-4.5 text-brand-primary shrink-0" />
                These hardware statistics were compiled during the latest synchronisation heartbeat on {formatDateTime(latestHeartbeat.timestamp)}.
              </div>

              <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
                {/* Tech Cards */}
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Layers className="h-5 w-5 text-brand-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Operating System</span>
                  </div>
                  <p className="mt-3.5 font-display text-lg font-black text-slate-800 capitalize leading-tight">
                    {latestHeartbeat.metadata.osPlatform}
                  </p>
                  <p className="mt-1.5 text-xs font-bold text-slate-400">
                    Release Build: {latestHeartbeat.metadata.osRelease}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-slate-400">
                    <CpuIcon className="h-5 w-5 text-violet-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Processor Architecture</span>
                  </div>
                  <p className="mt-3.5 font-display text-lg font-black text-slate-800 leading-tight truncate" title={latestHeartbeat.metadata.cpuModel}>
                    {latestHeartbeat.metadata.cpuModel}
                  </p>
                  <p className="mt-1.5 text-xs font-bold text-slate-400">
                    Allocated Core Count: {latestHeartbeat.metadata.cpuCores} Threads
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-slate-400">
                    <HardDrive className="h-5 w-5 text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">System Memory (RAM)</span>
                  </div>
                  <p className="mt-3.5 font-display text-lg font-black text-slate-800 leading-tight">
                    {latestHeartbeat.metadata.freeMemoryGB} GB Free
                  </p>
                  <p className="mt-1.5 text-xs font-bold text-slate-400">
                    Physical Installed Memory: {latestHeartbeat.metadata.totalMemoryGB} GB
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">System Timezone</span>
                  </div>
                  <p className="mt-3.5 font-display text-lg font-black text-slate-800 leading-tight">
                    {latestHeartbeat.metadata.timezone}
                  </p>
                  <p className="mt-1.5 text-xs font-bold text-slate-400">
                    Active Client Locale settings
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Layers className="h-5 w-5 text-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Runtime Engine</span>
                  </div>
                  <p className="mt-3.5 font-display text-lg font-black text-slate-800 leading-tight">
                    Electron v{latestHeartbeat.metadata.electronVersion}
                  </p>
                  <p className="mt-1.5 text-xs font-bold text-slate-400">
                    Chrome Engine Build: {latestHeartbeat.metadata.chromeVersion}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-slate-400">
                    <HardDrive className="h-5 w-5 text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Local DB Footprint</span>
                  </div>
                  <p className="mt-3.5 font-display text-lg font-black text-slate-800 leading-tight">
                    {latestHeartbeat.metadata.dbSizeMB} Megabytes (MB)
                  </p>
                  <p className="mt-1.5 text-xs font-bold text-slate-400">
                    SQLite storage volume size
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No Hardware Telemetry Compiled">
              Hardware characteristics, system architecture, and local database storage sizes will compile automatically once this client installation triggers its initial synchronisation heartbeat.
            </EmptyState>
          )}
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Activated Client Seats" description="Track hardware identities activated under this licensing key" />
            <div className="divide-y divide-slate-100">
              {client.activations.length ? (
                client.activations.map((activation) => (
                  <div key={activation.id} className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-slate-50/30 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-slate-800">{activation.hostname || 'Unidentified machine'}</p>
                        {activation.blockedAt ? (
                          <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">Hardware Blocked</span>
                        ) : activation.deactivatedAt ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Deactivated</span>
                        ) : (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">Active Terminal</span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-400 break-all leading-tight">
                        Hardware Hash: {activation.machineIdHash}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400 leading-none">
                        v{activation.appVersion || 'Unknown'} · Last reported ping: {formatDateTime(activation.lastSeenAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {activation.blockedAt ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={unblockMachine.isPending}
                          onClick={() => {
                            if (window.confirm(`Unblock this hardware device?`)) {
                              unblockMachine.mutate(activation.id)
                            }
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Unblock Hardware
                        </Button>
                      ) : activation.deactivatedAt ? (
                        <span className="text-xs font-semibold text-slate-400 px-3">Seat released</span>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            isLoading={deactivateMachine.isPending}
                            onClick={() => {
                              if (window.confirm(`Deactivate this hardware device seat?`)) {
                                deactivateMachine.mutate(activation.id)
                              }
                            }}
                          >
                            <Ban className="h-3.5 w-3.5 text-slate-500" /> Deactivate Seat
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            isLoading={blockMachine.isPending}
                            onClick={() => {
                              if (window.confirm(`Permanently block this hardware terminal hash from this license key?`)) {
                                blockMachine.mutate(activation.id)
                              }
                            }}
                          >
                            <Ban className="h-3.5 w-3.5" /> Block Hardware
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6"><EmptyState title="No active machines found" /></div>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="grid gap-6 xl:grid-cols-3">
          {/* Heartbeat log */}
          <Card className="flex flex-col">
            <CardHeader title="Heartbeat Timelines" description="Recent heartbeat signals (Last 10)" />
            <div className="flex-1 divide-y divide-slate-50 overflow-y-auto max-h-[480px]">
              {client.heartbeats?.length ? (
                client.heartbeats.slice(0, 10).map((beat) => (
                  <div key={beat.id} className="flex gap-3.5 p-4.5 group">
                    <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0 border border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                      <Activity className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{formatDateTime(beat.timestamp)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {beat.billsGenerated} bills · {beat.customers} clients · {beat.products} items
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400 leading-none">
                        V{beat.appVersion}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6"><EmptyState title="No heartbeat log history" /></div>
              )}
            </div>
          </Card>

          {/* Audit events */}
          <Card className="flex flex-col xl:col-span-2">
            <CardHeader title="Administrative Audit Trail" description="Latest record of admin operations (Last 12)" />
            <div className="flex-1 divide-y divide-slate-50 overflow-y-auto max-h-[480px]">
              {client.events?.length ? (
                client.events.slice(0, 12).map((event) => (
                  <div key={event.id} className="flex gap-4 p-4.5">
                    <span className="mt-1 flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 shrink-0">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-display text-sm font-bold text-slate-800 capitalize leading-tight">
                          {event.eventType.replaceAll('.', ' ')}
                        </p>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wide">
                          {event.actorType}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        Time: {formatDateTime(event.timestamp)} {event.actorId ? `· Actor ID: ${event.actorId}` : ''} {event.ipAddress ? `· IP: ${event.ipAddress}` : ''}
                      </p>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="mt-2 rounded bg-slate-50 p-2 font-mono text-[10px] text-slate-500 overflow-x-auto">
                          {JSON.stringify(event.metadata, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6"><EmptyState title="No administrative audit history" /></div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
