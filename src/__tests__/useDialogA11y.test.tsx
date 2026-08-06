import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRef, useState } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'

// Harness mínima: um botão gatilho fora do diálogo (pra testar restauração de
// foco) e um diálogo com 3 botões focáveis (pra testar o trap).
function Wrapper() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useDialogA11y(open, () => setOpen(false), containerRef)

  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      {open && (
        <div ref={containerRef} role="dialog" aria-modal="true">
          <button>Primeiro</button>
          <button>Meio</button>
          <button>Último</button>
        </div>
      )}
    </>
  )
}

describe('useDialogA11y', () => {
  it('foca o primeiro elemento focável ao abrir', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Abrir'))

    expect(screen.getByText('Primeiro')).toHaveFocus()
  })

  it('Tab no último elemento volta o foco para o primeiro', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Abrir'))
    screen.getByText('Último').focus()

    fireEvent.keyDown(screen.getByText('Último'), { key: 'Tab' })

    expect(screen.getByText('Primeiro')).toHaveFocus()
  })

  it('Shift+Tab no primeiro elemento leva o foco para o último', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Abrir'))
    screen.getByText('Primeiro').focus()

    fireEvent.keyDown(screen.getByText('Primeiro'), { key: 'Tab', shiftKey: true })

    expect(screen.getByText('Último')).toHaveFocus()
  })

  it('Escape chama onClose', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByText('Abrir'))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('restaura o foco no gatilho que abriu o diálogo, ao fechar', () => {
    render(<Wrapper />)
    const trigger = screen.getByText('Abrir')
    // fireEvent.click não move o foco no jsdom como um clique real faria —
    // foca explicitamente, reproduzindo quem chega ao gatilho via Tab.
    trigger.focus()
    fireEvent.click(trigger)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger).toHaveFocus()
  })

  it('foca initialFocusRef quando informado, mesmo não sendo o primeiro focável', () => {
    function WithInitialFocus() {
      const [open, setOpen] = useState(false)
      const containerRef = useRef<HTMLDivElement>(null)
      const closeRef = useRef<HTMLButtonElement>(null)
      useDialogA11y(open, () => setOpen(false), containerRef, closeRef)

      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          {open && (
            <div ref={containerRef} role="dialog" aria-modal="true">
              <a href="#baixar">Baixar</a>
              <button ref={closeRef}>Fechar</button>
            </div>
          )}
        </>
      )
    }
    render(<WithInitialFocus />)
    fireEvent.click(screen.getByText('Abrir'))

    expect(screen.getByText('Fechar')).toHaveFocus()
  })

  it('não mexe no foco quando open é false', () => {
    const onClose = vi.fn()
    function Inert() {
      const ref = useRef<HTMLDivElement>(null)
      useDialogA11y(false, onClose, ref)
      return <button>Fora do diálogo</button>
    }
    render(<Inert />)
    screen.getByText('Fora do diálogo').focus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
  })
})
