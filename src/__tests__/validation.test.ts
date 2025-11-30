import { describe, it, expect } from 'vitest'
import { passwordsMatch } from '../utils/validation'

describe('passwordsMatch', () => {
  it('retorna true para senhas idênticas', () => {
    expect(passwordsMatch('abc123', 'abc123')).toBe(true)
  })

  it('retorna false para senhas diferentes', () => {
    expect(passwordsMatch('abc123', 'abc124')).toBe(false)
  })

  it('retorna false para senhas vazias', () => {
    expect(passwordsMatch('', '')).toBe(false)
    expect(passwordsMatch('', 'a')).toBe(false)
  })

  it('trata caracteres especiais e composição unicode', () => {
    const a = 'á'
    const b = 'a\u0301'
    expect(passwordsMatch(a, b)).toBe(true)
    expect(passwordsMatch('😊', '😊')).toBe(true)
  })
})
