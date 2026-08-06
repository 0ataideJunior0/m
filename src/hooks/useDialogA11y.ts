import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

/**
 * Comportamento de acessibilidade compartilhado pelos diálogos `role="dialog"`
 * do app (Modal.tsx, o modal de PDF em Home.tsx, o de vídeo em WorkoutDay.tsx):
 * fecha com Esc, prende o Tab dentro do diálogo, foca o primeiro elemento
 * focável ao abrir, e restaura o foco em quem abriu o diálogo ao fechar.
 */
export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  containerRef: React.RefObject<HTMLElement>,
  initialFocusRef?: React.RefObject<HTMLElement>,
) {
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const initial = initialFocusRef?.current ?? getFocusable(containerRef.current!)[0]
    initial?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !containerRef.current) return

      const items = getFocusable(containerRef.current)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [open, onClose, containerRef, initialFocusRef])
}
