import React from 'react'
import type { ReactNode } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../lib'
import type { Plan, LicenseStatus } from '../lib'

// 1. Plan Configurations
export const planConfig: Record<Plan, { bg: string; text: string; ring: string; label: string }> = {
  starter: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    ring: 'ring-slate-600/10',
    label: 'Starter Plan',
  },
  professional: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-700/10',
    label: 'Professional Plan',
  },
  enterprise: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    ring: 'ring-purple-700/10',
    label: 'Enterprise Plan',
  },
}

// 2. Status Configurations
export const statusConfig: Record<LicenseStatus, { bg: string; text: string; ring: string; dot: string }> = {
  active: {
    bg: 'bg-emerald-50/80',
    text: 'text-emerald-700',
    ring: 'ring-emerald-600/10',
    dot: 'bg-emerald-500',
  },
  trial: {
    bg: 'bg-sky-50/80',
    text: 'text-sky-700',
    ring: 'ring-sky-600/10',
    dot: 'bg-sky-500',
  },
  grace: {
    bg: 'bg-amber-50/80',
    text: 'text-amber-700',
    ring: 'ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  expired: {
    bg: 'bg-rose-50/80',
    text: 'text-rose-700',
    ring: 'ring-rose-600/10',
    dot: 'bg-rose-500',
  },
  suspended: {
    bg: 'bg-red-950',
    text: 'text-red-100',
    ring: 'ring-red-900',
    dot: 'bg-red-400',
  },
}

// 3. Reusable Button
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 outline-none select-none active:scale-[0.98] disabled:active:scale-100 disabled:pointer-events-none disabled:opacity-50',
        
        // Sizes
        size === 'sm' && 'px-3 py-1.5 text-xs min-h-[34px]',
        size === 'md' && 'px-4.5 py-2.5 text-sm min-h-[42px]',
        size === 'lg' && 'px-6 py-3.5 text-base min-h-[50px]',
        
        // Variants
        variant === 'primary' && 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-premium hover:shadow-glow-blue hover:brightness-105 active:brightness-95',
        variant === 'secondary' && 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300 shadow-sm',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        variant === 'danger' && 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus:ring-2 focus:ring-rose-200',
        variant === 'success' && 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-200',
        
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span className="opacity-0">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

// 4. Reusable Inputs
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/15',
        className
      )}
    />
  )
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/15 appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10',
        className
      )}
    />
  )
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/15 min-h-[100px] resize-y',
        className
      )}
    />
  )
}

// 5. Reusable Card
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-slate-100 bg-white shadow-premium transition-all duration-300 hover:shadow-premium-hover', className)}>
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-4 border-b border-slate-50 px-6 py-5', className)}>
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-brand-dark">{title}</h2>
        {description && <p className="mt-1 text-xs font-semibold text-slate-400">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  )
}

// 6. Badges
export function PlanBadge({ plan }: { plan: Plan }) {
  const cfg = planConfig[plan] || planConfig.starter
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide capitalize ring-1 ring-inset', cfg.bg, cfg.text, cfg.ring)}>
      {cfg.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: LicenseStatus }) {
  const cfg = statusConfig[status] || statusConfig.active
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide capitalize ring-1 ring-inset', cfg.bg, cfg.text, cfg.ring)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
      {status}
    </span>
  )
}

// 7. Empty State Widget
export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string
  children?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
      {icon ? (
        <div className="mb-4 text-slate-300 [&>svg]:h-10 [&>svg]:w-10">{icon}</div>
      ) : (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <AlertCircle className="h-6 w-6" />
        </div>
      )}
      <h3 className="font-display text-sm font-bold text-slate-800">{title}</h3>
      {children && <div className="mt-1 text-xs font-semibold text-slate-400 max-w-sm">{children}</div>}
    </div>
  )
}

// 8. Animated Loader Spinner
export function LoadingState({ message = 'Loading system telemetry' }: { message?: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center p-8">
      <div className="relative flex items-center justify-center">
        {/* Glow rings */}
        <div className="absolute h-14 w-14 animate-ping rounded-full bg-brand-primary/10" />
        <div className="absolute h-10 w-10 animate-pulse rounded-full bg-brand-secondary/15" />
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
      <p className="mt-4 text-sm font-semibold tracking-wide text-brand-dark/70 animate-pulse">
        {message}...
      </p>
    </div>
  )
}

// 9. Error State Component
export function ErrorState({ retry, message }: { retry: () => void; message?: string }) {
  return (
    <EmptyState title="Sync Connection Blocked">
      <p className="mb-4 text-xs font-medium text-slate-400">
        {message || 'Unable to sync telemetry with license servers. Verify target service availability.'}
      </p>
      <Button size="sm" variant="secondary" onClick={retry}>
        Force Re-Sync
      </Button>
    </EmptyState>
  )
}
