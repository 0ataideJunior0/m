import { describe, it, expect } from 'vitest'
import { PIX_PLANS } from '../../api/_lib/pixPlans'
import { PIX_PLANS_DISPLAY, formatBRL } from '../utils/pixPlans'

// A vitrine e o servidor guardam os mesmos números em arquivos separados (o
// front não importa código de servidor). Este teste é o que impede os dois de
// divergirem em silêncio — o cenário ruim é a tela anunciar um preço e o
// Mercado Pago cobrar outro.
describe('planos de Pix: vitrine x servidor', () => {
  it('anuncia exatamente os planos que o servidor aceita', () => {
    expect(PIX_PLANS_DISPLAY.map((p) => p.id).sort()).toEqual(Object.keys(PIX_PLANS).sort())
  })

  it('anuncia o mesmo preço e o mesmo período que o servidor vai cobrar', () => {
    for (const display of PIX_PLANS_DISPLAY) {
      const server = PIX_PLANS[display.id]
      expect(server, `plano ${display.id} não existe no servidor`).toBeDefined()
      expect(display.amount, `preço divergente no plano ${display.id}`).toBe(server.amount)
      expect(display.months, `período divergente no plano ${display.id}`).toBe(server.months)
    }
  })

  it('o desconto anunciado no trimestral bate com a conta real', () => {
    const mensal = PIX_PLANS.mensal.amount
    const trimestral = PIX_PLANS.trimestral.amount
    const economia = mensal * 3 - trimestral
    const display = PIX_PLANS_DISPLAY.find((p) => p.id === 'trimestral')!
    expect(display.badge).toContain(formatBRL(economia).replace(/\s/g, ' ').replace('R$ ', 'R$ '))
  })
})
