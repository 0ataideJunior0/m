import { describe, it, expect } from 'vitest'
import { sessionCameFromEmailLink } from '../utils/sessionAmr'

const b64url = (v: unknown) =>
  btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const token = (claims: unknown) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.sig`

describe('sessionCameFromEmailLink (cliente)', () => {
  it('aceita otp, magiclink e recovery', () => {
    for (const method of ['otp', 'magiclink', 'recovery']) {
      expect(sessionCameFromEmailLink(token({ amr: [{ method, timestamp: 1 }] }))).toBe(true)
    }
  })

  it('recusa sessão de senha, sem amr ou token malformado', () => {
    expect(sessionCameFromEmailLink(token({ amr: [{ method: 'password', timestamp: 1 }] }))).toBe(false)
    expect(sessionCameFromEmailLink(token({ sub: 'u1' }))).toBe(false)
    expect(sessionCameFromEmailLink('tok')).toBe(false)
    expect(sessionCameFromEmailLink('a.%%%.c')).toBe(false)
    expect(sessionCameFromEmailLink('')).toBe(false)
  })

  it('decodifica payload base64url com caracteres fora do ASCII', () => {
    expect(
      sessionCameFromEmailLink(
        `x.${btoa(unescape(encodeURIComponent(JSON.stringify({ name: 'Ação ~~~???', amr: [{ method: 'otp' }] })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`,
      ),
    ).toBe(true)
  })
})
