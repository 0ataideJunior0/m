import { ReactNode, useRef } from 'react'
import { X } from 'lucide-react'
import { useDialogA11y } from '../../hooks/useDialogA11y'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  /** 'full' (padrão) cobre a tela, como os modais de formulário/vídeo já usam.
   *  'card' fica centralizado, do tamanho de um card — pra conteúdo curto que
   *  não precisa de todo o espaço da tela. */
  size?: 'full' | 'card'
}

export default function Modal({ open, onClose, title, children, footer, size = 'full' }: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useDialogA11y(open, onClose, containerRef)

  if (!open) return null

  const closeButton = (
    <button
      onClick={onClose}
      aria-label="Fechar"
      className="ui-hover bg-surface border border-border text-text px-3 py-2 rounded-md flex items-center"
    >
      <X className="w-4 h-4 mr-1" />
      Fechar
    </button>
  )

  if (size === 'card') {
    return (
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="bg-surface rounded-3xl shadow-lg w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
          <div className="p-3 flex items-center justify-between border-b border-border">
            <div className="font-semibold text-text-strong">{title}</div>
            {closeButton}
          </div>
          <div className="overflow-y-auto">{children}</div>
          {footer && <div className="p-3 border-t border-border">{footer}</div>}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm flex flex-col">
      <div className="bg-surface/95 p-3 flex items-center justify-between">
        <div className="font-semibold text-text-strong">{title}</div>
        {closeButton}
      </div>
      <div className="flex-1 bg-surface overflow-y-auto">{children}</div>
      {footer && <div className="bg-surface/95 p-3">{footer}</div>}
    </div>
  )
}
