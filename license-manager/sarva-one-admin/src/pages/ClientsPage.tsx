import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, RotateCcw, Ban, RefreshCcw, Copy, Eye, Check } from 'lucide-react'
import { api, copyText } from '../lib'
import type { Client } from '../lib'
import { Card, Input, Select, PlanBadge, StatusBadge, Button, LoadingState, ErrorState } from '../components/ui'

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('shopName')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const params = new URLSearchParams()
  params.set('pageSize', '100')
  if (search) params.set('q', search)
  if (plan) params.set('plan', plan)
  if (status) params.set('status', status)
  if (sort) params.set('sort', sort)

  const query = useQuery({ 
    queryKey: ['clients', params.toString()], 
    queryFn: () => api.clients(params.toString()) 
  })
  
  const qc = useQueryClient()

  const clientAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'reactivate' | 'reset' }) =>
      action === 'suspend' ? api.suspend(id) : action === 'reactivate' ? api.reactivate(id) : api.resetMachine(id),
    onMutate: async ({ id, action }) => {
      await qc.cancelQueries({ queryKey: ['clients'] })
      const previous = qc.getQueryData<Client[]>(['clients', params.toString()])
      
      if (action !== 'reset') {
        qc.setQueryData<Client[]>(['clients', params.toString()], (old) => 
          old?.map((client) => 
            client.id === id 
              ? { ...client, status: action === 'suspend' ? 'suspended' : 'active' } 
              : client
          )
        )
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['clients', params.toString()], context.previous)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  const triggerCopy = (id: string, key: string) => {
    copyText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  if (query.isLoading) return <LoadingState message="Fetching active client terminals" />
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />

  const clients = query.data

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Filtering and Search Controls */}
      <Card className="p-4.5">
        <div className="grid gap-3.5 md:grid-cols-[1fr_180px_180px_180px]">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4.5 w-4.5" />
            </span>
            <Input 
              className="pl-10.5 placeholder:text-slate-400" 
              placeholder="Search shop, owner, phone..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">All Tiers</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="pro">Pro</option>
            <option value="custom">Custom</option>
          </Select>

          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </Select>

          <Select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="shopName">Sort: Shop Name</option>
            <option value="ownerName">Sort: Owner Name</option>
            <option value="plan">Sort: Service Plan</option>
            <option value="status">Sort: License Status</option>
            <option value="expiresAt">Sort: Expiration Date</option>
            <option value="lastHeartbeatAt">Sort: Last Heartbeat</option>
          </Select>
        </div>
      </Card>

      {/* Main Clients Grid / Table Card */}
      <Card className="overflow-hidden border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5.5 py-4">Shop details</th>
                <th className="px-4 py-4">Owner name</th>
                <th className="px-4 py-4">Contact phone</th>
                <th className="px-4 py-4">Service plan</th>
                <th className="px-4 py-4">Licensing status</th>
                <th className="px-4 py-4">Expiration date</th>
                <th className="px-4 py-4">Last heartbeat</th>
                <th className="px-5.5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {clients.length ? (
                clients.map((client) => (
                  <tr key={client.id} className="group hover:bg-slate-50/40 transition duration-150">
                    <td className="px-5.5 py-4.5">
                      <div className="max-w-[200px]">
                        <p className="font-display font-bold text-slate-800 tracking-tight leading-tight truncate">
                          {client.shopName}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400 leading-none truncate">
                          ID: {client.id.slice(0, 8)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4.5 font-semibold text-slate-800">
                      {client.ownerName}
                    </td>
                    <td className="px-4 py-4.5 font-medium text-slate-500">
                      {client.phone}
                    </td>
                    <td className="px-4 py-4.5">
                      <PlanBadge plan={client.plan} />
                    </td>
                    <td className="px-4 py-4.5">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="px-4 py-4.5 font-semibold text-slate-500">
                      {new Date(client.expiresAt || '').toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-4.5">
                      {client.lastHeartbeatAt ? (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-600 leading-none">
                            {new Date(client.lastHeartbeatAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 leading-none">
                            {new Date(client.lastHeartbeatAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">Never synced</span>
                      )}
                    </td>
                    <td className="px-5.5 py-4.5 text-right">
                      <div className="inline-flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition duration-150">
                        {/* View Details */}
                        <NavLink 
                          title="View telemetry dossier"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-brand-primary hover:border-brand-primary/30 transition shadow-sm" 
                          to={`/clients/${client.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </NavLink>

                        {/* Copy Key */}
                        <Button 
                          title="Copy license key to clipboard"
                          variant="secondary" 
                          className="h-9 w-9 p-0" 
                          onClick={() => triggerCopy(client.id, client.licenseKey)}
                        >
                          {copiedId === client.id ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Suspend / Reactivate */}
                        <Button 
                          title={client.status === 'suspended' ? 'Reactivate licensing privileges' : 'Suspend client license'}
                          variant="secondary" 
                          className="h-9 w-9 p-0" 
                          onClick={() => {
                            if (client.status === 'suspended' || window.confirm(`Suspend license for ${client.shopName}? The shop will lose access immediately.`)) {
                              clientAction.mutate({ 
                                id: client.id, 
                                action: client.status === 'suspended' ? 'reactivate' : 'suspend' 
                              })
                            }
                          }}
                        >
                          {client.status === 'suspended' ? (
                            <RotateCcw className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Ban className="h-4 w-4 text-rose-600" />
                          )}
                        </Button>

                        {/* Reset machine binding */}
                        <Button 
                          title="Reset machine hardware binding"
                          variant="secondary" 
                          className="h-9 w-9 p-0" 
                          onClick={() => {
                            if (window.confirm(`Reset machine hardware binding for ${client.shopName}? They will need to re-activate on their next startup.`)) {
                              clientAction.mutate({ id: client.id, action: 'reset' })
                            }
                          }}
                        >
                          <RefreshCcw className="h-4 w-4 text-amber-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <span className="text-slate-400 font-medium">No clients match your filter configuration.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
