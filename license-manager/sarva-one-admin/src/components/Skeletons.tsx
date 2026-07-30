import { cn } from '../lib'

function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-slate-200',
        className
      )}
      style={style}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5.5 shadow-premium">
      <div className="flex items-center justify-between gap-3">
        <Pulse className="h-3 w-24" />
        <Pulse className="h-9 w-9 shrink-0 rounded-xl" />
      </div>
      <Pulse className="mt-4 h-8 w-20" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-premium">
      <div className="border-b border-slate-50 px-6 py-5 space-y-1.5">
        <Pulse className="h-4 w-40" />
        <Pulse className="h-3 w-64" />
      </div>
      <div className="flex items-end justify-around h-72 px-6 pb-6 pt-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Pulse
            key={i}
            className="flex-1"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-premium overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75">
              {Array.from({ length: 8 }).map((_, i) => (
                <th key={i} className="px-4 py-4">
                  <Pulse className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {Array.from({ length: 8 }).map((_, colIdx) => (
                  <td key={colIdx} className="px-4 py-4.5">
                    <Pulse className={cn('h-4', colIdx === 0 ? 'w-28' : colIdx === 1 ? 'w-20' : 'w-16')} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
        <Pulse className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Pulse className="h-5 w-48" />
          <Pulse className="h-3 w-64" />
        </div>
      </div>

      <div className="flex border-b border-slate-100 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-10 w-28 rounded-lg" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-white p-6 space-y-4 shadow-premium">
              <Pulse className="h-4 w-36" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex gap-3">
                    <Pulse className="h-3 w-28" />
                    <Pulse className="h-3 w-40" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Pulse key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Pulse className="h-80 rounded-xl" />
          <Pulse className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-premium p-6 space-y-4">
      <div className="space-y-1.5">
        <Pulse className="h-4 w-36" />
        <Pulse className="h-3 w-56" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rounded-xl border border-slate-100 bg-white shadow-premium p-6 space-y-4">
        <Pulse className="h-4 w-44" />
        <Pulse className="h-3 w-64" />
        <div className="grid gap-4.5 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Pulse className="h-3 w-20" />
              <Pulse className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <Pulse className="h-80 rounded-xl" />
    </div>
  )
}
