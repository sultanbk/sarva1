import { useState, useRef, useCallback } from 'react'
import { useConfirmDialog } from '../hooks/useConfirmDialog.tsx'
import { NavLink } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMutationToast } from '../hooks/useMutationToast'
import { Search, RotateCcw, Ban, RefreshCcw, Copy, Eye, Check, Download, Calendar } from 'lucide-react'
import { api, copyText, timeAgo, daysRemaining } from '../lib'
import type { Client } from '../lib'
import { Card, Input, Select, PlanBadge, StatusBadge, Button, ErrorState } from '../components/ui'
import { SortTh } from '../components/SortTh'
import { TableSkeleton } from '../components/Skeletons'

export default function ClientsPage() {
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('shopName')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  // Pagination State
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Bulk Extend Dialog State
  const [showBulkExtend, setShowBulkExtend] = useState(false)
  const [bulkMonths, setBulkMonths] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (search) params.set('q', search)
  if (plan) params.set('plan', plan)
  if (status) params.set('status', status)
  if (sort) params.set('sort', sort)

  const query = useQuery({ 
    queryKey: ['clients', params.toString()], 
    queryFn: () => api.clients(params.toString()) 
  })
  
  const qc = useQueryClient()

  const clientAction = useMutationToast({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'reactivate' | 'reset' }) =>
      action === 'suspend' ? api.suspend(id) : action === 'reactivate' ? api.reactivate(id) : api.resetMachine(id),
    onMutate: async ({ id, action }) => {
      await qc.cancelQueries({ queryKey: ['clients'] })
      const previous = qc.getQueryData<{ licenses: Client[]; pagination: any }>(['clients', params.toString()])

      if (action !== 'reset' && previous) {
        qc.setQueryData<{ licenses: Client[]; pagination: any }>(['clients', params.toString()], (old) => {
          if (!old) return old
          return {
            ...old,
            licenses: old.licenses.map((client) =>
              client.id === id
                ? { ...client, status: action === 'suspend' ? 'suspended' : 'active' }
                : client
            )
          }
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['clients', params.toString()], context.previous)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['clients'] }),
    successMessage: (_, vars) =>
      vars.action === 'suspend' ? 'License suspended' :
      vars.action === 'reactivate' ? 'License reactivated' :
      'Machine binding reset',
  })

  const bulkExtendMutation = useMutationToast({
    mutationFn: () => api.bulkExtend(selectedIds, bulkMonths),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setSelectedIds([])
      setShowBulkExtend(false)
    },
    successMessage: `Extended ${selectedIds.length} licenses by ${bulkMonths} month(s)`,
  })

  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmDialog()

  const triggerCopy = (id: string, key: string) => {
    copyText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // Handle Search / Filter state updates and reset page to 1
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      setSelectedIds([])
    }, 300)
  }, [])

  const handlePlanChange = (val: string) => {
    setPlan(val)
    setPage(1)
    setSelectedIds([])
  }

  const handleStatusChange = (val: string) => {
    setStatus(val)
    setPage(1)
    setSelectedIds([])
  }

  const handleSortChange = (val: string) => {
    setSort(val)
    setPage(1)
    setSelectedIds([])
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && query.data?.licenses) {
      setSelectedIds(query.data.licenses.map((c) => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id])
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const handleCSVExport = () => {
    const clientsToExport = query.data?.licenses || []
    if (!clientsToExport.length) return
    
    const headers = ['Shop Name', 'Owner Name', 'Phone', 'Email', 'Plan', 'Status', 'License Key', 'Expires At']
    const rows = clientsToExport.map((c) => [
      c.shopName,
      c.ownerName,
      c.phone,
      c.email || '',
      c.plan,
      c.status,
      c.licenseKey,
      c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN') : ''
    ])
    
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (query.isLoading) return <TableSkeleton rows={5} />
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />

  const { licenses: clients, pagination } = query.data
  const totalPages = Math.ceil(pagination.total / pagination.pageSize)
  const allSelectedOnPage = clients.length > 0 && selectedIds.length === clients.length

  return (
    <div className="space-y-6">
      {/* Action panel for selected rows */}
      {selectedIds.length > 0 && (
        <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4 flex items-center justify-between animate-fadeIn shadow-sm">
          <div className="text-sm font-bold text-brand-dark">
            <span className="bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-md mr-2">{selectedIds.length}</span>
            Selected Client Records
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowBulkExtend(true)}
              className="flex items-center gap-1.5"
            >
              <Calendar className="h-4 w-4" /> Bulk Extend Expiry
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Filtering and Search Controls */}
      <Card className="p-4.5">
        <div className="grid gap-3.5 md:grid-cols-[1fr_180px_180px_180px_120px]">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4.5 w-4.5" />
            </span>
            <Input 
              className="pl-10.5 placeholder:text-slate-400" 
              placeholder="Search shop, owner, phone..." 
              value={search} 
              onChange={(e) => handleSearchChange(e.target.value)} 
            />
          </div>
          
          <Select value={plan} onChange={(e) => handlePlanChange(e.target.value)}>
            <option value="">All Tiers</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>

          <Select value={status} onChange={(e) => handleStatusChange(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </Select>

          <Select value={sort} onChange={(e) => handleSortChange(e.target.value)}>
            <option value="shopName">Sort: Shop Name</option>
            <option value="ownerName">Sort: Owner Name</option>
            <option value="plan">Sort: Service Plan</option>
            <option value="status">Sort: License Status</option>
            <option value="expiresAt">Sort: Expiration Date</option>
            <option value="lastHeartbeatAt">Sort: Last Heartbeat</option>
          </Select>

          <Button variant="secondary" onClick={handleCSVExport} className="flex items-center gap-1.5 justify-center">
            <Download className="h-4 w-4" /> Export Page
          </Button>
        </div>
      </Card>

      {/* Main Clients Grid / Table Card */}
      <Card className="overflow-hidden border-slate-100">
        <div className="overflow-auto max-h-[calc(100vh-18rem)]">
          <table className="w-full min-w-[1080px] text-left border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded text-brand-primary focus:ring-brand-primary cursor-pointer h-4 w-4"
                  />
                </th>
                <SortTh field="shopName" sort={sort} onSort={setSort}>Shop details</SortTh>
                <SortTh field="ownerName" sort={sort} onSort={setSort}>Owner name</SortTh>
                <th className="px-4 py-4">Contact phone</th>
                <SortTh field="plan" sort={sort} onSort={setSort}>Service plan</SortTh>
                <SortTh field="status" sort={sort} onSort={setSort}>Licensing status</SortTh>
                <SortTh field="expiresAt" sort={sort} onSort={setSort}>Expiration date</SortTh>
                <SortTh field="lastHeartbeatAt" sort={sort} onSort={setSort}>Last heartbeat</SortTh>
                <th className="px-5.5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {clients.length ? (
                clients.map((client) => {
                  const isChecked = selectedIds.includes(client.id)
                  return (
                    <tr key={client.id} className={`group hover:bg-slate-50/40 transition duration-150 ${isChecked ? 'bg-brand-primary/5 hover:bg-brand-primary/10' : ''}`}>
                      <td className="px-4 py-4.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectOne(client.id, e.target.checked)}
                          className="rounded text-brand-primary focus:ring-brand-primary cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-4.5">
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
                      <td className="px-4 py-4.5">
                        {(() => { const dr = daysRemaining(client.expiresAt)
                          return (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-600 leading-none text-sm">
                                {new Date(client.expiresAt || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold leading-none ${
                                dr.urgent ? 'text-rose-600' : dr.warning ? 'text-amber-600' : 'text-emerald-600'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  dr.urgent ? 'bg-rose-500' : dr.warning ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} />
                                {dr.label}
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-4.5">
                        {client.lastHeartbeatAt ? (
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-600 leading-none text-sm">
                              {timeAgo(client.lastHeartbeatAt)}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 leading-none">
                              {new Date(client.lastHeartbeatAt).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short',
                              })}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            Never synced
                          </span>
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
                            onClick={async () => {
                              if (client.status === 'suspended') {
                                clientAction.mutate({ id: client.id, action: 'reactivate' })
                                return
                              }
                              const ok = await confirmAction(
                                `Suspend license for ${client.shopName}? The shop will lose access immediately.`,
                                { title: 'Suspend License', variant: 'danger', confirmLabel: 'Suspend' }
                              )
                              if (ok) clientAction.mutate({ id: client.id, action: 'suspend' })
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
                            onClick={async () => {
                              const ok = await confirmAction(
                                `Reset machine hardware binding for ${client.shopName}? They will need to re-activate on their next startup.`,
                                { title: 'Reset Machine Binding', variant: 'warning', confirmLabel: 'Reset' }
                              )
                              if (ok) clientAction.mutate({ id: client.id, action: 'reset' })
                            }}
                          >
                            <RefreshCcw className="h-4 w-4 text-amber-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <span className="text-slate-400 font-medium">No clients match your filter configuration.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-sm text-slate-500">
          <span>Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> (Total <strong>{pagination.total}</strong> clients)</span>
          <div className="inline-flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Extend Dialog */}
      {showBulkExtend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-white border border-slate-100 p-6 animate-fadeIn shadow-2xl">
            <h3 className="font-display text-lg font-black text-brand-dark mb-2">Bulk Expiry Extension</h3>
            <p className="text-xs font-semibold text-slate-400 mb-4">
              Extend the expiration date for <span className="text-brand-primary">{selectedIds.length}</span> selected client licenses.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Extension Duration</label>
                <Select
                  value={bulkMonths}
                  onChange={(e) => setBulkMonths(Number(e.target.value))}
                >
                  <option value={1}>1 Month (+30 Days)</option>
                  <option value={3}>3 Months (+90 Days)</option>
                  <option value={6}>6 Months (+180 Days)</option>
                  <option value={12}>1 Year (+365 Days)</option>
                </Select>
              </div>

              <div className="flex gap-2.5 pt-3">
                <Button
                  className="flex-1"
                  variant="primary"
                  isLoading={bulkExtendMutation.isPending}
                  onClick={() => bulkExtendMutation.mutate()}
                >
                  Confirm Extension
                </Button>
                <Button
                  variant="secondary"
                  disabled={bulkExtendMutation.isPending}
                  onClick={() => setShowBulkExtend(false)}
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
