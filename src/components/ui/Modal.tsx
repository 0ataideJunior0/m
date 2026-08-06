import { ReactNode, useRef } from 'react'
import { X } from 'lucide-react'
import { useDialogA11y } from '../../hooks/useDialogA11y'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useDialogA11y(open, onClose, containerRef)

  if (!open) return null

  return (
    <div ref={containerRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
      <div className="bg-white/95 dark:bg-surface/95 p-3 flex items-center justify-between">
        <div className="font-semibold text-gray-900 dark:text-text">{title}</div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="ui-hover bg-white dark:bg-surface border border-gray-300 dark:border-border text-gray-900 dark:text-text px-3 py-2 rounded-md flex items-center"
        >
          <X className="w-4 h-4 mr-1" />
          Fechar
        </button>
      </div>
      <div className="flex-1 bg-white dark:bg-surface overflow-y-auto">{children}</div>
      {footer && <div className="bg-white/95 dark:bg-surface/95 p-3">{footer}</div>}
    </div>
  )
}
