import { useState, useEffect, useRef } from 'react'
import { useConfirmDialog } from '../hooks/useConfirmDialog.tsx'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMutationToast } from '../hooks/useMutationToast'
import {
  ArrowLeft, Ban, RotateCcw, CalendarClock, RefreshCcw, Copy, Trash2,
  Cpu, HardDrive, CpuIcon, Layers, Laptop, ShieldCheck, WifiOff,
  Activity, Info, Clock, Check, CreditCard, DollarSign, ScrollText
} from 'lucide-react'
import { api, formatDate, formatDateTime, formatCurrency, copyText, timeAgo, daysRemaining, connectionStatus } from '../lib'
import type { ClientDetail, Plan } from '../lib'
import {
  Card, CardHeader, PlanBadge, StatusBadge, Button,
  Input, Select, ErrorState, EmptyState
} from '../components/ui'
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { DetailSkeleton } from '../components/Skeletons'
import { ClientLogsView } from '../components/ClientLogsView'

export default function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'diagnostics' | 'devices' | 'history' | 'payments' | 'logs'>('overview')
  const [copiedKey, setCopiedKey] = useState(false)

  const query = useQuery({ 
    queryKey: ['client', id], 
    queryFn: () => api.client(id), 
    enabled: Boolean(id) 
  })

  const update = useMutationToast({
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
    successMessage: 'Client record updated',
  })

  const remove = useMutationToast({
    mutationFn: () => api.deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/clients')
    },
    successMessage: 'Client license archived',
  })

  const reset = useMutationToast({
    mutationFn: () => api.resetMachine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
    successMessage: 'Machine binding reset',
  })

  const deactivateMachine = useMutationToast({
    mutationFn: (activationId: string) => api.deactivateMachine(id, activationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
    successMessage: 'Seat deactivated',
  })

  const blockMachine = useMutationToast({
    mutationFn: (activationId: string) => api.blockMachine(id, activationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
    successMessage: 'Hardware blocked',
  })

  const unblockMachine = useMutationToast({
    mutationFn: (activationId: string) => api.unblockMachine(id, activationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
    successMessage: 'Hardware unblocked',
  })

  const reactivate = useMutationToast({
    mutationFn: () => api.reactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
    },
    successMessage: 'License reactivated',
  })

  // Payment / Renewal Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMonths, setPaymentMonths] = useState(1)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentProvider, setPaymentProvider] = useState('manual')
  const [paymentIdRef, setPaymentIdRef] = useState('')

  const quoteQuery = useQuery({
    queryKey: ['renewal-quote', id, paymentMonths],
    queryFn: () => api.renewalQuote(id, paymentMonths),
    enabled: showPaymentModal && Boolean(id)
  })

  useEffect(() => {
    if (quoteQuery.data) {
      setPaymentAmount(quoteQuery.data.amount)
    }
  }, [quoteQuery.data])

  const recordPayment = useMutationToast({
    mutationFn: () => api.recordManualPayment(id, {
      amount: paymentAmount,
      months: paymentMonths,
      provider: paymentProvider,
      providerPaymentId: paymentIdRef || undefined
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      setShowPaymentModal(false)
      setPaymentIdRef('')
    },
    successMessage: 'Payment recorded successfully',
  })

  const handleCopyKey = (key: string) => {
    copyText(key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 1500)
  }

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmDialog()
  function DebouncedSeatsInput({
    value, onChange, disabled
  }: {
    value: number; onChange: (val: number) => void; disabled: boolean
  }) {
    const [local, setLocal] = useState(value)
    const ref = useRef(value)
    useEffect(() => { setLocal(value); ref.current = value }, [value])
    const onBlur = () => {
      if (local !== ref.current && local >= 1 && local <= 99) onChange(local)
    }
    return (
      <Input type="number" min="1" max="99" value={local}
        onChange={(e) => setLocal(Number(e.target.value || 1))}
        onBlur={onBlur} disabled={disabled} />
    )
  }

  function AutoSaveTextarea({
    defaultValue, onSave, disabled
  }: {
    defaultValue: string; onSave: (val: string) => void; disabled: boolean
  }) {
    const [value, setValue] = useState(defaultValue)
    const [saving, setSaving] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => { setValue(defaultValue ?? '') }, [defaultValue])
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (e.target.value !== (defaultValue ?? '')) {
          setSaving(true)
          onSave(e.target.value)
          setTimeout(() => setSaving(false), 600)
        }
      }, 1500)
    }
    return (
      <div className="relative">
        <textarea className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/15 min-h-[100px] resize-y"
          value={value} onChange={handleChange} disabled={disabled}
          placeholder="Enter account remarks here... (auto-saves 1.5s after typing stops)" />
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-bold text-slate-400">
          {saving ? (
            <span className="flex items-center gap-1"><span className="h-2 w-2 animate-ping rounded-full bg-amber-400" /> Saving...</span>
          ) : (
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Auto-save ready</span>
          )}
        </div>
      </div>
    )
  }

  if (query.isLoading) return <DetailSkeleton />
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />

  const client = query.data
  const latestHeartbeat = client.heartbeats?.[0]

  return (
    <div className="space-y-6">
      {/* Offline alert banner – shown when client hasn't checked in for >1 hour */}
      {(() => {
        const cs = connectionStatus(client.lastHeartbeatAt)
        if (cs !== 'offline' && cs !== 'never') return null
        const isNever = cs === 'never'
        return (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm">
            <WifiOff className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-700">
                {isNever ? 'Client has never sent a heartbeat' : 'Client is not reporting to the server'}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-rose-500">
                {isNever
                  ? 'The app may not have been opened or the license has not been activated yet.'
                  : `Last heartbeat received ${timeAgo(client.lastHeartbeatAt)} (${formatDateTime(client.lastHeartbeatAt)}). The app may be closed, offline, or experiencing a connectivity issue.`
                }
              </p>
            </div>
          </div>
        )
      })()}

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
                {(() => {
                  const cs = connectionStatus(client.lastHeartbeatAt)
                  if (cs === 'online') return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      Online
                    </span>
                  )
                  if (cs === 'stale') return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Stale
                    </span>
                  )
                  if (cs === 'offline') return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Offline
                    </span>
                  )
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      Never Connected
                    </span>
                  )
                })()}
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
        <button
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-bold tracking-tight transition outline-none ${
            activeTab === 'payments'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <CreditCard className="h-4.5 w-4.5" /> Payments
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-bold tracking-tight transition outline-none ${
            activeTab === 'logs'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <ScrollText className="h-4.5 w-4.5" /> Client Logs
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
                <div className="grid grid-cols-[130px_1fr] py-3.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Days Remaining</span>
                  <span>{(() => { const dr = daysRemaining(client.expiresAt); return (
                    <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${
                      dr.urgent ? 'text-rose-600' : dr.warning ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${
                        dr.urgent ? 'bg-rose-500 animate-pulse' : dr.warning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      {dr.label}
                    </span>
                  )})()}</span>
                </div>
                {client.graceEndsAt && (
                  <div className="grid grid-cols-[130px_1fr] py-3.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grace Ends</span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      {formatDate(client.graceEndsAt)} ({timeAgo(client.graceEndsAt)})
                    </span>
                  </div>
                )}
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
                    onClick={async () => {
                      const ok = await confirmAction(
                        `Suspend license for ${client.shopName}? The shop will lose access immediately.`,
                        { title: 'Suspend License', variant: 'danger', confirmLabel: 'Suspend' }
                      )
                      if (ok) update.mutate({ status: 'suspended' })
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
                    onClick={() => {
                      setPaymentMonths(1)
                      setPaymentProvider('manual')
                      setPaymentIdRef('')
                      setShowPaymentModal(true)
                    }}
                  >
                    <CalendarClock className="h-4.5 w-4.5 text-brand-primary" /> Renew License & Pay
                  </Button>

                  <Button 
                    variant="secondary" 
                    className="justify-start text-left cursor-pointer"
                    onClick={async () => {
                      const ok = await confirmAction(
                        `Reset machine binding for ${client.shopName}?`,
                        { title: 'Reset Machine Binding', variant: 'warning', confirmLabel: 'Reset' }
                      )
                      if (ok) reset.mutate()
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
                      onChange={async (e) => {
                        const newPlan = e.target.value as Plan
                        const planRank = { starter: 0, professional: 1, enterprise: 2 }
                        if (planRank[newPlan] < planRank[client.plan]) {
                          const ok = await confirmAction(
                            `Downgrade from ${client.plan} to ${newPlan}? This may reduce available features.`,
                            { title: 'Downgrade Plan', variant: 'warning', confirmLabel: 'Downgrade' }
                          )
                          if (!ok) return
                        }
                        update.mutate({ plan: newPlan })
                      }}
                      disabled={update.isPending}
                    >
                      <option value="starter">Starter</option>
                      <option value="professional">Professional</option>
                      <option value="enterprise">Enterprise</option>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Max Device Seats</label>
                    <DebouncedSeatsInput
                      value={client.maxSeats ?? 1}
                      onChange={(val) => update.mutate({ maxSeats: val })}
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
            <div className="grid grid-cols-5 gap-3">
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
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center" onClick={() => setActiveTab('logs')} style={{ cursor: 'pointer' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Errors Logged</span>
                <p className="mt-1 font-display text-lg font-black text-rose-600">{(client.logSummary?.byLevel?.error ?? 0) + (client.logSummary?.byLevel?.fatal ?? 0)}</p>
              </div>
            </div>

            {/* Bill Activity Chart */}
            <Card>
              <CardHeader title="Client Billing Volume" description="Cumulative generated bills over time" />
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

            {/* Customer & Product Growth Charts */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader title="Customer Growth" description="Total customer records over time" />
                <div className="h-52 px-6 pb-6 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(() => {
                      const map = new Map<string, number>()
                      client.heartbeats.forEach((h) => {
                        const d = new Date(h.timestamp)
                        const key = Number.isNaN(d.getTime()) ? h.timestamp : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        map.set(key, Math.max(map.get(key) ?? 0, h.customers))
                      })
                      return Array.from(map, ([date, customers]) => ({ date, customers })).reverse().slice(-30)
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="customers" stroke="#7c3aed" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardHeader title="Product Catalog Growth" description="Total catalogued products over time" />
                <div className="h-52 px-6 pb-6 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(() => {
                      const map = new Map<string, number>()
                      client.heartbeats.forEach((h) => {
                        const d = new Date(h.timestamp)
                        const key = Number.isNaN(d.getTime()) ? h.timestamp : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                        map.set(key, Math.max(map.get(key) ?? 0, h.products))
                      })
                      return Array.from(map, ([date, products]) => ({ date, products })).reverse().slice(-30)
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="products" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Internal Notes Card */}
            <Card>
              <CardHeader title="Administrative Notes" description="Internal remarks regarding client account history" />
              <div className="p-6">
                <AutoSaveTextarea
                  defaultValue={client.notes ?? ''}
                  onSave={(val) => update.mutate({ notes: val })}
                  disabled={update.isPending}
                />
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
                  onClick={async () => {
                    const ok = await confirmAction(
                      `Archive client license for ${client.shopName}?`,
                      { title: 'Archive License', variant: 'danger', confirmLabel: 'Archive' }
                    )
                    if (ok) remove.mutate()
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

              {/* Resource Usage Trends */}
              {(() => {
                const series = client.heartbeats
                  .slice()
                  .reverse()
                  .slice(-30)
                  .filter((hb) => hb.metadata?.dbSizeMB != null)
                  .map((hb) => {
                    const ramUsed = hb.metadata && hb.metadata.totalMemoryGB != null && hb.metadata.freeMemoryGB != null
                      ? Math.max(0, Math.round((hb.metadata.totalMemoryGB - hb.metadata.freeMemoryGB) * 100) / 100)
                      : null
                    return {
                      date: hb.timestamp ? new Date(hb.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—',
                      dbSizeMB: hb.metadata?.dbSizeMB ?? 0,
                      ramUsedGB: ramUsed ?? 0
                    }
                  })

                return series.length ? (
                  <div className="grid gap-4.5 xl:grid-cols-2">
                    <Card>
                      <CardHeader title="Local DB Size Trend" description="SQLite storage footprint across recent heartbeats" />
                      <div className="h-56 px-4 pb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="dbSizeMB" name="DB Size (MB)" stroke="#2563eb" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                    <Card>
                      <CardHeader title="RAM Usage Trend" description="Approximate memory in use across recent heartbeats" />
                      <div className="h-56 px-4 pb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="ramUsedGB" name="RAM Used (GB)" stroke="#7c3aed" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>
                ) : null
              })()}
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
                          onClick={async () => {
                            const ok = await confirmAction(
                              `Unblock this hardware device?`,
                              { title: 'Unblock Hardware', variant: 'default', confirmLabel: 'Unblock' }
                            )
                            if (ok) unblockMachine.mutate(activation.id)
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
                            onClick={async () => {
                              const ok = await confirmAction(
                                `Deactivate this hardware device seat?`,
                                { title: 'Deactivate Seat', variant: 'warning', confirmLabel: 'Deactivate' }
                              )
                              if (ok) deactivateMachine.mutate(activation.id)
                            }}
                          >
                            <Ban className="h-3.5 w-3.5 text-slate-500" /> Deactivate Seat
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            isLoading={blockMachine.isPending}
                            onClick={async () => {
                              const ok = await confirmAction(
                                `Permanently block this hardware terminal hash from this license key?`,
                                { title: 'Block Hardware', variant: 'danger', confirmLabel: 'Block' }
                              )
                              if (ok) blockMachine.mutate(activation.id)
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

      {activeTab === 'payments' && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payment History" description="All recorded payments for this client license" />
            {client.payments?.length ? (
              <div className="divide-y divide-slate-50">
                {client.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-4 p-5 hover:bg-slate-50/30 transition">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-display text-sm font-bold text-slate-800">
                          {formatCurrency(payment.amount)}
                          <span className="ml-2 text-xs font-semibold text-slate-400 uppercase">{payment.currency}</span>
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {payment.provider} · {formatDateTime(payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      payment.status === 'completed' || payment.status === 'success' || payment.status === 'succeeded'
                        ? 'bg-emerald-50 text-emerald-700'
                        : payment.status === 'pending' || payment.status === 'initiated'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6"><EmptyState title="No payments recorded" icon={<CreditCard className="h-10 w-10 text-slate-300" />}>
                <p>No payment transactions have been recorded for this client yet. Use the "Renew License & Pay" action to record a payment.</p>
              </EmptyState></div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
          <ClientLogsView licenseId={id} />
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-white border border-slate-100 p-6 animate-fadeIn shadow-2xl">
            <h3 className="font-display text-lg font-black text-brand-dark mb-2">Record License Payment</h3>
            <p className="text-xs font-semibold text-slate-400 mb-4">
              Extend the expiration date for this client terminal by recording a manual payment.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Billing Period</label>
                <Select
                  value={paymentMonths}
                  onChange={(e) => setPaymentMonths(Number(e.target.value))}
                >
                  <option value={1}>1 Month (+30 Days)</option>
                  <option value={3}>3 Months (+90 Days)</option>
                  <option value={6}>6 Months (+180 Days)</option>
                  <option value={12}>1 Year (+365 Days)</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Quote Amount (INR)</label>
                {quoteQuery.isLoading ? (
                  <div className="text-xs text-slate-400 py-1">Loading price quote...</div>
                ) : (
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    placeholder="Enter amount paid"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Payment Method</label>
                <Select
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                >
                  <option value="manual">Cash / Direct Bank Transfer</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                  <option value="gpay">GPay / PhonePe UPI</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Transaction ID / Reference (Optional)</label>
                <Input
                  type="text"
                  value={paymentIdRef}
                  onChange={(e) => setPaymentIdRef(e.target.value)}
                  placeholder="Txn ID, receipt number, bank reference..."
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <Button
                  className="flex-1"
                  variant="primary"
                  isLoading={recordPayment.isPending}
                  onClick={() => recordPayment.mutate()}
                >
                  Record Payment
                </Button>
                <Button
                  variant="secondary"
                  disabled={recordPayment.isPending}
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      {confirmDialog}
    </div>
  )
}
