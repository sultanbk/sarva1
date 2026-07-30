import { cn } from '../lib'
import type { ReactNode } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface SortThProps {
  field: string
  sort: string
  onSort: (v: string) => void
  children: ReactNode
  className?: string
}

export function SortTh({ field, sort, onSort, children, className }: SortThProps) {
  const active = sort === field || sort === '-' + field
  const dir = sort === '-' + field ? 'desc' : active ? 'asc' : null
  const cycle = () => {
    if (sort !== field && sort !== '-' + field) { onSort(field); return }
    if (sort === field) { onSort('-' + field); return }
    onSort('shopName')
  }
  return (
    <th className={cn('px-4 py-4 select-none', className)}>
      <button
        onClick={cycle}
        className="inline-flex items-center gap-1 hover:text-slate-700 transition cursor-pointer"
      >
        {children}
        {dir ? (
          dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <span className="h-3.5 w-3.5" />
        )}
      </button>
    </th>
  )
}
