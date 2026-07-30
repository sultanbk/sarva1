import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../components/Modal'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    message: string
    resolve: (val: boolean) => void
    title: string
    confirmLabel?: string
    cancelLabel?: string
    variant: 'danger' | 'warning' | 'default'
  } | null>(null)

  const confirm = (message: string, opts?: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        message,
        resolve,
        title: opts?.title ?? 'Confirm Action',
        confirmLabel: opts?.confirmLabel,
        cancelLabel: opts?.cancelLabel,
        variant: opts?.variant ?? 'default',
      })
    })
  }

  const dialog = state ? (
    <ConfirmDialog
      isOpen
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={() => { state.resolve(true); setState(null) }}
      onCancel={() => { state.resolve(false); setState(null) }}
    />
  ) : null

  return { confirm, dialog }
}
