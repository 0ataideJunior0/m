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

  it('começa parado, mostrando os 90 segundos padrão', () => {
    render(<RestTimer />)

    const button = screen.getByRole('button', { name: /iniciar descanso/i })
    expect(button).toHaveTextContent('1:30')
  })

  it('ao tocar, inicia a contagem regressiva segundo a segundo', () => {
    render(<RestTimer />)

    fireEvent.click(screen.getByRole('button', { name: /iniciar descanso/i }))
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('button')).toHaveTextContent('1:29')

    act(() => {
      vi.advanceTimersByTime(29_000)
    })
    expect(screen.getByRole('button')).toHaveTextContent('1:00')
  })

  it('tocar de novo enquanto conta reinicia para 90 segundos', () => {
    render(<RestTimer />)

    const button = screen.getByRole('button', { name: /iniciar descanso/i })
    fireEvent.click(button)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(button).toHaveTextContent('1:20')

    fireEvent.click(button)
    expect(button).toHaveTextContent('1:30')
  })

  it('ao chegar a zero, vibra (se suportado) e volta pro estado parado em seguida', () => {
    const vibrateMock = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrateMock, configurable: true })

    render(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: /iniciar descanso/i }))

    act(() => {
      vi.advanceTimersByTime(90_000)
    })
    expect(screen.getByRole('button')).toHaveTextContent('0:00')
    expect(vibrateMock).toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('button', { name: /iniciar descanso/i })).toHaveTextContent('1:30')
  })

  it('não quebra quando o navegador não suporta vibração', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true })

    render(<RestTimer />)
    fireEvent.click(screen.getByRole('button', { name: /iniciar descanso/i }))

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(90_000)
      })
    }).not.toThrow()
  })
})
