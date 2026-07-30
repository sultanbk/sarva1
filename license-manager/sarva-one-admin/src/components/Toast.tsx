import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '../lib'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export type Toast = {
  id: string
  message: string
  type: ToastType
}

type ToastContextValue = {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++toastCounter}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 4000)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <Toaster toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

const iconMap: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <AlertCircle className="h-5 w-5 text-rose-500" />,
  info: <Info className="h-5 w-5 text-sky-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
}

const toastStyles: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm font-semibold shadow-lg',
            toastStyles[toast.type]
          )}
          style={{
            animation: 'slideIn 0.25s ease-out',
          }}
        >
          <span className="shrink-0 mt-0.5">{iconMap[toast.type]}</span>
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
