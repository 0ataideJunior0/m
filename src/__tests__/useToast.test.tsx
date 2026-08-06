import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../hooks/useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('começa sem toast nenhum', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toast).toBeNull()
  })

  it('show define a mensagem e a variante', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.show('Treino salvo com sucesso!', 'success')
    })

    expect(result.current.toast).toEqual({ message: 'Treino salvo com sucesso!', variant: 'success' })
  })

  it('usa "error" como variante padrão quando não informada', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.show('Vídeo não disponível.')
    })

    expect(result.current.toast?.variant).toBe('error')
  })

  it('dismiss limpa o toast imediatamente', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.show('Oi') })

    act(() => { result.current.dismiss() })

    expect(result.current.toast).toBeNull()
  })

  it('some sozinho depois de 5s', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.show('Oi') })
    expect(result.current.toast).not.toBeNull()

    act(() => { vi.advanceTimersByTime(5000) })

    expect(result.current.toast).toBeNull()
  })

  it('chamar show de novo reinicia a contagem do auto-dismiss', () => {
    const { result } = renderHook(() => useToast())
    act(() => { result.current.show('Primeiro') })

    act(() => { vi.advanceTimersByTime(4000) })
    act(() => { result.current.show('Segundo') })
    act(() => { vi.advanceTimersByTime(4000) })

    // 4s + 4s = 8s > 5s, mas o segundo show reiniciou o timer aos 4s,
    // então só se passaram 4s desde ele — ainda deve estar visível.
    expect(result.current.toast?.message).toBe('Segundo')
  })
})
