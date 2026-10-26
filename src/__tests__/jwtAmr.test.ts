import { describe, it, expect } from 'vitest'
import { sessionCameFromEmailLink } from '../../api/_lib/jwtAmr'

function tokenWith(payload: unknown): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.assinatura`
}

describe('sessionCameFromEmailLink', () => {
  it('é falso para sessão aberta com senha', () => {
    expect(sessionCameFromEmailLink(tokenWith({ amr: [{ method: 'password', timestamp: 1 }] }))).toBe(false)
  })

  it.each(['otp', 'magiclink', 'recovery'])('é verdadeiro para o método %s', (method) => {
    expect(sessionCameFromEmailLink(tokenWith({ amr: [{ method, timestamp: 1 }] }))).toBe(true)
  })

  it('é verdadeiro se qualquer entrada do amr veio do link', () => {
    const amr = [{ method: 'password' }, { method: 'otp' }]
    expect(sessionCameFromEmailLink(tokenWith({ amr }))).toBe(true)
  })

  it('é falso sem amr, com amr malformado ou com token inválido', () => {
    expect(sessionCameFromEmailLink(tokenWith({}))).toBe(false)
    expect(sessionCameFromEmailLink(tokenWith({ amr: 'otp' }))).toBe(false)
    expect(sessionCameFromEmailLink(tokenWith({ amr: [null, 'otp', { method: 1 }] }))).toBe(false)
    expect(sessionCameFromEmailLink('nao-e-um-jwt')).toBe(false)
    expect(sessionCameFromEmailLink('a.%%%.c')).toBe(false)
    expect(sessionCameFromEmailLink('')).toBe(false)
  })
})
