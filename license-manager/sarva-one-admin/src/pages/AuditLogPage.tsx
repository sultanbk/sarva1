import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../lib'
import { Card, Input, Select, Button, LoadingState, ErrorState } from '../components/ui'

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [actorType, setActorType] = useState('')
  const [eventType, setEventType] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (actorType) params.set('actorType', actorType)
  if (eventType) params.set('eventType', eventType)
  if (search) params.set('q', search)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-log', params.toString()],
    queryFn: () => api.auditLog(params.toString()),
  })

  if (isLoading) return <LoadingState message="Fetching console audit trails" />
  if (isError || !data) return <ErrorState retry={() => refetch()} />

  const { events, pagination } = data
  const totalPages = Math.ceil(pagination.total / pagination.pageSize)

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Filtering and Search Controls */}
      <Card className="p-4.5">
        <div className="grid gap-3.5 md:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search className="h-4.5 w-4.5" />
            </span>
            <Input 
              className="pl-10.5 placeholder:text-slate-400" 
              placeholder="Search by actor email/ID or event type..." 
              value={search} 
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }} 
            />
          </div>
          
          <Select value={actorType} onChange={(e) => {
            setActorType(e.target.value)
            setPage(1)
          }}>
            <option value="">All Actors</option>
            <option value="admin">Admin</option>
            <option value="client">Client</option>
            <option value="system">System</option>
          </Select>

          <Select value={eventType} onChange={(e) => {
            setEventType(e.target.value)
            setPage(1)
          }}>
            <option value="">All Event Types</option>
            <option value="admin.login_failed">Login Failed</option>
            <option value="admin.password_changed">Password Changed</option>
            <option value="license.created">License Created</option>
            <option value="license.updated">License Updated</option>
            <option value="license.suspended">License Suspended</option>
            <option value="license.reactivated">License Reactivated</option>
            <option value="license.machine_reset">Machine Reset</option>
            <option value="license.machine_deactivated">Machine Deactivated</option>
            <option value="license.machine_blocked">Machine Blocked</option>
            <option value="license.machine_unblocked">Machine Unblocked</option>
            <option value="payment.manual_recorded">Manual Payment Recorded</option>
            <option value="license.renewed">License Renewed</option>
          </Select>
        </div>
      </Card>

      {/* Main Audit Log Table Card */}
      <Card className="overflow-hidden border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5.5 py-4 w-12"></th>
                <th className="px-4 py-4 w-44">Timestamp</th>
                <th className="px-4 py-4">Actor</th>
                <th className="px-4 py-4">Event Type</th>
                <th className="px-4 py-4">IP Address</th>
                <th className="px-5.5 py-4 text-right">Scope Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {events.length ? (
                events.map((event) => {
                  const isExpanded = expandedId === event.id
                  return (
                    <>
                      <tr key={event.id} className="hover:bg-slate-50/40 transition duration-150">
                        <td className="px-5.5 py-4 text-center">
                          <button
                            onClick={() => toggleExpand(event.id)}
                            className="p-1 hover:bg-slate-100 rounded-md transition text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-slate-500">
                          {new Date(event.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded leading-none ${
                              event.actorType === 'admin' ? 'bg-indigo-50 text-indigo-700' :
                              event.actorType === 'client' ? 'bg-emerald-50 text-emerald-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {event.actorType}
                            </span>
                            <span className="truncate max-w-[150px]" title={event.actorId || undefined}>
                              {event.actorId || 'system'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {event.eventType}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-slate-500">
                          {event.ipAddress || 'internal'}
                        </td>
                        <td className="px-5.5 py-4 text-right">
                          {event.licenseId ? (
                            <span className="text-xs font-bold text-slate-400">
                              License: {event.licenseId.slice(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-300">Global scope</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/30">
                          <td colSpan={6} className="px-10 py-4.5 border-t border-slate-100/50">
                            <div className="space-y-2">
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payload Metadata</p>
                              <pre className="text-xs font-mono text-slate-600 bg-white border border-slate-100 p-4 rounded-xl overflow-x-auto shadow-inner leading-relaxed max-w-full">
                                {JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <span className="text-slate-400 font-medium">No events logged matching this search profile.</span>
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
          <span>Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong></span>
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
    </div>
  )
}
