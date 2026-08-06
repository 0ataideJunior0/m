import { useCallback, useRef, useState } from 'react'

export type ToastVariant = 'success' | 'error'

interface ToastState {
  message: string
  variant: ToastVariant
}

const AUTO_DISMISS_MS = 5000

/**
 * Substitui alert() por um toast não bloqueante. Uso local por página —
 * não é um store global, cada tela que precisa de feedback chama seu
 * próprio useToast() e renderiza <Toast toast={toast} onDismiss={dismiss} />.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  const show = useCallback((message: string, variant: ToastVariant = 'error') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, variant })
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS)
  }, [])

  return { toast, show, dismiss }
}
