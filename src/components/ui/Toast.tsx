import { CheckCircle, AlertCircle, X } from 'lucide-react'
import type { ToastVariant } from '../../hooks/useToast'

interface ToastProps {
  toast: { message: string; variant: ToastVariant } | null
  onDismiss: () => void
}

const VARIANT_STYLE: Record<ToastVariant, string> = {
  success: 'border-green-300 dark:border-green-800 text-green-700 dark:text-green-400',
  error: 'border-red-300 dark:border-red-800 text-red-700 dark:text-red-400',
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null

  const Icon = toast.variant === 'success' ? CheckCircle : AlertCircle

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={`fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-md flex items-start gap-2 rounded-2xl border bg-surface shadow-lg p-4 ${VARIANT_STYLE[toast.variant]}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
