import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

export interface ToastOptions {
  variant?: ToastVariant
  durationMs?: number
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, opts?: ToastOptions) => string
  dismiss: (id: string) => void
}

let counter = 0
function nextId(): string {
  counter += 1
  return `toast-${counter}`
}

// Global toast queue. Components call useToastStore.getState().push(...) from
// anywhere (stores included). Toasts auto-expire; ToastViewport renders them.
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, opts) => {
    const id = nextId()
    const variant = opts?.variant ?? 'info'
    set({ toasts: [...get().toasts, { id, message, variant }] })
    const duration = opts?.durationMs ?? 2600
    if (duration > 0) {
      window.setTimeout(() => get().dismiss(id), duration)
    }
    return id
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))

// Convenience helper usable outside React.
export const toast = {
  success: (m: string) => useToastStore.getState().push(m, { variant: 'success' }),
  error: (m: string) => useToastStore.getState().push(m, { variant: 'error' }),
  info: (m: string) => useToastStore.getState().push(m, { variant: 'info' })
}
