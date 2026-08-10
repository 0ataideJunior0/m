import { describe, it, expect, vi } from 'vitest'

const { singleMock, eqMock, selectMock, fromMock } = vi.hoisted(() => {
  const singleMock = vi.fn()
  const eqMock = vi.fn(() => ({ single: singleMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))
  return { singleMock, eqMock, selectMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { getMealPlan } from '../utils/plans'

describe('getMealPlan', () => {
  it('retorna o plano quando a query funciona', async () => {
    singleMock.mockResolvedValueOnce({
      data: { type: 'mass_gain', title: 'Ganho de Massa', description: null, content_md: '# Plano', updated_at: '' },
      error: null,
    })

    const result = await getMealPlan('mass_gain')

    expect(fromMock).toHaveBeenCalledWith('meal_plans')
    expect(eqMock).toHaveBeenCalledWith('type', 'mass_gain')
    expect(result?.content_md).toBe('# Plano')
  })

  it('retorna null quando a RLS bloqueia (sem assinatura ativa)', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const result = await getMealPlan('fat_loss')

    expect(result).toBeNull()
  })
})
