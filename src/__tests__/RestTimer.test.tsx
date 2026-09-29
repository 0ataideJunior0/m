import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import RestTimer from '../components/RestTimer'

describe('RestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('começa fechado, só com o botão de abrir o descanso', () => {
    render(<RestTimer />)

    expect(screen.getByRole('button', { name: /descanso/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ao clicar, abre o modal e já inicia a contagem em 90 segundos', () => {
    render(<RestTimer />)

    fireEvent.click(screen.getByRole('button', { name: /descanso/i }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('1:30')
  })

  it('a contagem no modal decresce segundo a segundo', () => {
    render(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: /descanso/i }))

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('dialog')).toHaveTextContent('1:29')

    act(() => {
      vi.advanceTimersByTime(29_000)
    })
    expect(screen.getByRole('dialog')).toHaveTextContent('1:00')
  })

  it('fechar o modal no meio da contagem cancela e reinicia pra próxima vez', () => {
    render(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: /descanso/i }))
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    fireEvent.click(screen.getByRole('button', { name: /fechar/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /descanso/i }))
    expect(screen.getByRole('dialog')).toHaveTextContent('1:30')
  })

  it('ao chegar a zero, vibra (se suportado) e fecha o modal sozinho em seguida', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, configurable: true })

    render(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: /descanso/i }))

    act(() => {
      vi.advanceTimersByTime(90_000)
    })
    expect(screen.getByRole('dialog')).toHaveTextContent('0:00')
    expect(vibrateMock).toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('não quebra quando o navegador não suporta vibração', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true })

    render(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: /descanso/i }))

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(90_000)
      })
    }).not.toThrow()
  })
})
