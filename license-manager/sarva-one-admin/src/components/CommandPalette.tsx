import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutDashboard, Store, Plus, Activity, Settings } from 'lucide-react'
import { Modal } from './Modal'

interface Command {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
}

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const commands: Command[] = [
    { id: 'dashboard', label: 'Go to Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: () => navigate('/') },
    { id: 'clients', label: 'Go to Clients List', icon: <Store className="h-4 w-4" />, action: () => navigate('/clients') },
    { id: 'create', label: 'Generate New License', icon: <Plus className="h-4 w-4" />, action: () => navigate('/clients/new') },
    { id: 'audit', label: 'View Audit Log', icon: <Activity className="h-4 w-4" />, action: () => navigate('/audit-log') },
    { id: 'settings', label: 'Open Console Config', icon: <Settings className="h-4 w-4" />, action: () => navigate('/settings') },
  ]

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) { setQuery(''); setSelectedIdx(0) }
  }, [isOpen])

  const run = (cmd: Command) => { cmd.action(); onClose() }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && filtered[selectedIdx]) { run(filtered[selectedIdx]) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
          onKeyDown={handleKeyDown}
          placeholder="Search pages and actions..."
          className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/15"
        />
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto -mx-1">
        {filtered.length ? (
          filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => run(cmd)}
              onMouseEnter={() => setSelectedIdx(i)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition cursor-pointer ${
                i === selectedIdx ? 'bg-brand-primary/10 text-brand-primary' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="shrink-0 text-slate-400">{cmd.icon}</span>
              {cmd.label}
            </button>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-xs font-semibold text-slate-400">No results found</p>
        )}
      </div>
      <div className="mt-4 border-t border-slate-50 pt-3 flex items-center gap-4 text-[10px] font-bold text-slate-400">
        <span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">↑↓</kbd> Navigate</span>
        <span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">Enter</kbd> Open</span>
        <span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">Esc</kbd> Close</span>
      </div>
    </Modal>
  )
}
