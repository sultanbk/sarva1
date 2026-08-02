import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, RefreshCw, Zap, AlertCircle, Info, HelpCircle, Terminal, ChevronLeft, ChevronRight } from 'lucide-react'
import { api, type LogLevel } from '../lib'
import { Card, Input, Select, Button, EmptyState, ErrorState } from './ui'
import { formatDateTime, timeAgo, cn } from '../lib'

interface ClientLogsViewProps {
  licenseId?: string
  licenseOptions?: Array<{ id: string; shopName: string }>
}

const levelColors: Record<LogLevel, string> = {
  debug: 'bg-slate-100 text-slate-700 border-slate-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  warn: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-rose-100 text-rose-700 border-rose-200',
  fatal: 'bg-red-950 text-red-100 border-red-900'
}

const levelIcons: Record<LogLevel, React.ReactNode> = {
  debug: <HelpCircle className="h-3 w-3" />,
  info: <Info className="h-3 w-3" />,
  warn: <AlertCircle className="h-3 w-3" />,
  error: <AlertCircle className="h-3 w-3" />,
  fatal: <Zap className="h-3 w-3" />
}

export function ClientLogsView({ licenseId, licenseOptions }: ClientLogsViewProps) {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [live, setLive] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const params = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('pageSize', String(pageSize))
    if (level !== 'all') p.set('level', level)
    if (search) p.set('q', search)
    if (source) p.set('source', source)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    return p.toString()
  }, [page, level, search, source, from, to])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['client-logs', licenseId ?? 'all', params],
    queryFn: () => licenseId ? api.clientLogs(licenseId, params) : api.clientLogsGlobal(params),
    refetchInterval: live ? 5000 : false,
    enabled: licenseId ? true : !!licenseOptions
  })

  const totalPages = data ? Math.ceil(data.pagination.total / data.pagination.pageSize) : 1

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  if (isLoading) {
    return (
      <Card>
        <div className="animate-pulse space-y-3 p-4">
          <div className="h-12 w-full rounded-lg bg-slate-100" />
          <div className="h-12 w-full rounded-lg bg-slate-100" />
          <div className="h-12 w-full rounded-lg bg-slate-100" />
        </div>
      </Card>
    )
  }

  if (isError) return <ErrorState retry={() => refetch()} />

  if (!data) return <EmptyState title="No logs available" />

  const logs = data.logs
  const summary = data.summary

  return (
    <div className="space-y-6">
      {/* Filter Card */}
      <Card className="p-4.5">
        <div className="grid gap-3.5 md:grid-cols-[1fr_1fr_180px_180px_160px_120px] items-end">
          {licenseOptions && !licenseId && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Client</label>
              <Select
                value=""
                onChange={(e) => {
                  if (e.target.value) window.location.href = `/clients/${e.target.value}?tab=logs`
                }}
              >
                <option value="">All Clients</option>
                {licenseOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.shopName}</option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Search (message/source)</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <Input
                placeholder="Filter logs..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Level</label>
            <Select value={level} onChange={(e) => { setLevel(e.target.value as LogLevel | 'all'); setPage(1) }}>
              <option value="all">All Levels</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="fatal">Fatal</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Source</label>
            <Input
              placeholder="Component..."
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1) }}
            />
          </div>
          <div className="md:col-span-2 grid gap-3.5 grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">From</label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">To</label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={live ? 'success' : 'secondary'}
              size="sm"
              onClick={() => setLive(!live)}
              className={cn(live && 'bg-emerald-100 text-emerald-700 border-emerald-200')}
            >
              {live && <span className="relative flex h-2 w-2 mr-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span></span>}
              {live ? 'Live' : 'Live Mode'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setPage(1); refetch() }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Chips */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          {(['debug', 'info', 'warn', 'error', 'fatal'] as LogLevel[]).map((lvl) => (
            <span key={lvl} className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border', levelColors[lvl])}>
              {levelIcons[lvl]}
              {summary.byLevel[lvl] ?? 0}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-700 border-slate-200">
            <Terminal className="h-3 w-3" />
            {summary.total}
          </span>
        </div>
      )}

      {/* Log Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-500">Level</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Source</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Machine</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Message</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Shop</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    {licenseId ? 'No logs for this client' : 'No logs found'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => toggleExpand(log.id)}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${levelColors[log.level]}`}>
                        {levelIcons[log.level]} {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDateTime(log.createdAt)} <span className="text-slate-400">({timeAgo(log.createdAt)})</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      {log.source ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      {log.machineId}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-md truncate" title={log.message}>
                      {log.message}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.shopName ?? log.licenseId.slice(0, 8) + '...'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded Details */}
        {expandedId && logs.find((l) => l.id === expandedId) && (
          <div className="border-t border-slate-200 bg-slate-50/50 p-4">
            {(() => {
              const log = logs.find((l) => l.id === expandedId)!
              return (
                <div className="space-y-4">
                  {log.stackTrace && (
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
                        <Terminal className="h-3.5 w-3.5" />
                        Stack Trace
                      </div>
                      <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[11px] overflow-x-auto max-h-64">{log.stackTrace}</pre>
                    </div>
                  )}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
                        <Terminal className="h-3.5 w-3.5" />
                        Metadata
                      </div>
                      <pre className="bg-slate-100 text-slate-800 p-3 rounded text-[11px] overflow-x-auto max-h-64">{JSON.stringify(log.metadata, null, 2)}</pre>
                    </div>
                  )}
                  {log.clientTs && (
                    <div className="text-xs text-slate-500">
                      Client timestamp: {formatDateTime(log.clientTs)}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}