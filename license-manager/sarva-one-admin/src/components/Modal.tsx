import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../lib'
import { Button } from './ui'

/* ─── Modal ─────────────────────────────────────────── */

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-xl',
}

export function Modal({ isOpen, onClose, title, children, className, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  /* Focus trap: auto-focus first focusable when open */
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const focusable = el.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [isOpen])

  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  /* Body scroll lock */
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full rounded-xl border border-slate-100 bg-white shadow-2xl animate-fadeIn',
          sizeMap[size],
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4.5">
            <h2 className="font-display text-lg font-bold tracking-tight text-brand-dark">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
        <div className={cn('p-6', !title && 'pt-6')}>{children}</div>
      </div>
    </div>,
    document.body
  )
}

/* ─── ConfirmDialog (convenience wrapper) ─────────────── */

interface ConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <p className="text-sm font-medium text-slate-600 leading-relaxed">{message}</p>
      <div className="mt-6 flex items-center justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : variant === 'warning' ? 'danger' : 'primary'}
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
