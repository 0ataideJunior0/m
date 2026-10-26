import { describe, it, expect } from 'vitest'
import { authErrorMessage, isSamePasswordError } from '../utils/authErrors'

describe('authErrorMessage', () => {
  it('cadastro com e-mail que já tem conta (por código e por mensagem)', () => {
    const expected = "Já existe uma conta com esse e-mail. Entre ou use 'Esqueci a senha'."
    expect(authErrorMessage({ code: 'user_already_exists', message: 'x' })).toBe(expected)
    expect(authErrorMessage({ message: 'User already registered' })).toBe(expected)
  })

  it('login com credencial errada (por código e por mensagem)', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'x' })).toBe('E-mail ou senha incorretos.')
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.')
  })

  it('o código tem precedência sobre a mensagem', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'User already registered' })).toBe(
      'E-mail ou senha incorretos.',
    )
  })

  it('senha fraca e excesso de tentativas', () => {
    expect(authErrorMessage({ code: 'weak_password', message: 'x' })).toBe('A senha deve ter pelo menos 6 caracteres.')
    expect(authErrorMessage({ message: 'Password should be at least 6 characters.' })).toBe(
      'A senha deve ter pelo menos 6 caracteres.',
    )
    expect(authErrorMessage({ code: 'over_request_rate_limit', message: 'x' })).toBe(
      'Muitas tentativas. Espere um pouco e tente de novo.',
    )
  })

  it('erro desconhecido, vazio ou ausente cai na mensagem padrão em português', () => {
    const fallback = 'Não foi possível concluir. Tente de novo.'
    expect(authErrorMessage({ message: 'Something unexpected happened' })).toBe(fallback)
    expect(authErrorMessage(new Error('Failed to fetch'))).toBe(fallback)
    expect(authErrorMessage(null)).toBe(fallback)
  })
})

describe('isSamePasswordError', () => {
  it('reconhece por código e por mensagem', () => {
    expect(isSamePasswordError({ code: 'same_password', message: 'x' })).toBe(true)
    expect(isSamePasswordError({ message: 'New password should be different from the old password.' })).toBe(true)
    expect(isSamePasswordError({ code: 'weak_password', message: 'x' })).toBe(false)
    expect(isSamePasswordError(null)).toBe(false)
  })
})
