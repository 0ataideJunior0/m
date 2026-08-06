import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Toast from '../components/ui/Toast'

describe('Toast', () => {
  it('não renderiza nada quando toast é null', () => {
    const { container } = render(<Toast toast={null} onDismiss={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra a mensagem', () => {
    render(<Toast toast={{ message: 'Treino salvo com sucesso!', variant: 'success' }} onDismiss={vi.fn()} />)
    expect(screen.getByText('Treino salvo com sucesso!')).toBeInTheDocument()
  })

  it('usa role="alert" para erro e role="status" para sucesso', () => {
    const { rerender } = render(<Toast toast={{ message: 'falhou', variant: 'error' }} onDismiss={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(<Toast toast={{ message: 'ok', variant: 'success' }} onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('chama onDismiss ao clicar em fechar', () => {
    const onDismiss = vi.fn()
    render(<Toast toast={{ message: 'Oi', variant: 'error' }} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByLabelText('Fechar aviso'))

    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
