import { describe, it, expect, vi } from 'vitest'

const { singleMock, eqMock, fromMock } = vi.hoisted(() => {
  const singleMock = vi.fn()
  const eqMock = vi.fn(() => ({ single: singleMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))
  return { singleMock, eqMock, selectMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { getIsAdmin } from '../utils/profile'

describe('getIsAdmin', () => {
  it('retorna true quando is_admin é true', async () => {
    singleMock.mockResolvedValueOnce({ data: { is_admin: true }, error: null })
    const result = await getIsAdmin('u1')
    expect(fromMock).toHaveBeenCalledWith('profiles')
    expect(eqMock).toHaveBeenCalledWith('id', 'u1')
    expect(result).toBe(true)
  })

  it('retorna false quando is_admin é false', async () => {
    singleMock.mockResolvedValueOnce({ data: { is_admin: false }, error: null })
    const result = await getIsAdmin('u2')
    expect(result).toBe(false)
  })

  it('retorna false quando há erro na consulta', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    const result = await getIsAdmin('u3')
    expect(result).toBe(false)
  })
})
