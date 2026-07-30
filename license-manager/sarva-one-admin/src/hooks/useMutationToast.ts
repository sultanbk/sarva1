import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useToast } from '../components/Toast'

interface UseMutationToastOptions<TData, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'onSuccess' | 'onError'> {
  successMessage?: string | ((data: TData) => string)
  errorMessage?: string | ((error: Error) => string)
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void
}

function resolveMessage<T>(msg: string | ((d: T) => string) | undefined, data: T, fallback: string): string {
  if (typeof msg === 'function') return msg(data)
  if (typeof msg === 'string') return msg
  return fallback
}

export function useMutationToast<TData = unknown, TVariables = void, TContext = unknown>(
  options: UseMutationToastOptions<TData, TVariables, TContext>,
) {
  const { addToast } = useToast()

  return useMutation<TData, Error, TVariables, TContext>({
    mutationFn: options.mutationFn,
    ...options,
    onSuccess: (data, variables, context) => {
      options.onSuccess?.(data, variables, context)
      addToast(resolveMessage(options.successMessage, data, 'Operation completed successfully'), 'success')
    },
    onError: (error, variables, context) => {
      options.onError?.(error, variables, context)
      addToast(resolveMessage(options.errorMessage, error, error.message || 'Operation failed'), 'error')
    },
  } as UseMutationOptions<TData, Error, TVariables, TContext>)
}
