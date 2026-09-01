import { describe, it, expect } from 'vitest'
import {
  buildPixExternalReference,
  parsePixExternalReference,
  addMonths,
} from '../../api/_lib/pixPeriod'

describe('external_reference do Pix', () => {
  it('faz ida e volta do que foi construído', () => {
    const ref = buildPixExternalReference('user-1', 3)
    expect(parsePixExternalReference(ref)).toEqual({ userId: 'user-1', months: 3 })
  })

  it('ignora o external_reference das assinaturas no cartão (user id puro)', () => {
    expect(parsePixExternalReference('224e4c07-a10c-49e6-ba3e-ffa7f6c38e99')).toBeNull()
  })

  it('rejeita entradas malformadas em vez de creditar acesso errado', () => {
    expect(parsePixExternalReference(null)).toBeNull()
    expect(parsePixExternalReference('')).toBeNull()
    expect(parsePixExternalReference('user-1|pix')).toBeNull()
    expect(parsePixExternalReference('user-1|boleto|3')).toBeNull()
    expect(parsePixExternalReference('user-1|pix|0')).toBeNull()
    expect(parsePixExternalReference('user-1|pix|-3')).toBeNull()
    expect(parsePixExternalReference('user-1|pix|abc')).toBeNull()
    expect(parsePixExternalReference('|pix|3')).toBeNull()
  })
})

describe('addMonths', () => {
  it('soma meses mantendo o dia', () => {
    expect(addMonths(new Date('2026-08-19T12:00:00.000Z'), 3).toISOString()).toContain('2026-11-19')
  })

  it('vira o ano corretamente', () => {
    expect(addMonths(new Date('2026-11-19T12:00:00.000Z'), 3).toISOString()).toContain('2027-02-19')
  })

  it('não estoura para o mês seguinte quando o dia não existe no destino', () => {
    // 31/01 + 1 mês não pode virar 03/03: sem o clamp o JavaScript daria dias
    // de acesso a mais e uma data que não bate com a prometida na tela.
    const result = addMonths(new Date(2026, 0, 31, 12, 0, 0), 1)
    expect(result.getMonth()).toBe(1) // fevereiro
    expect(result.getDate()).toBe(28) // 2026 não é bissexto
  })

  it('respeita ano bissexto no clamp', () => {
    const result = addMonths(new Date(2028, 0, 31, 12, 0, 0), 1)
    expect(result.getMonth()).toBe(1)
    expect(result.getDate()).toBe(29)
  })
})
