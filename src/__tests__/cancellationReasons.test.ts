import { describe, it, expect } from 'vitest'
import { CANCELLATION_REASONS } from '../../api/_lib/cancellationReasons'
import { CANCELLATION_REASONS_DISPLAY } from '../utils/cancellationReasons'

// A vitrine e o servidor guardam a mesma lista em arquivos separados (o front
// não importa código de servidor). Este teste impede os dois de divergirem em
// silêncio — o cenário ruim é a tela oferecer um motivo que o servidor recusa.
describe('motivos de cancelamento: vitrine x servidor', () => {
  it('anuncia exatamente os motivos que o servidor aceita', () => {
    expect(CANCELLATION_REASONS_DISPLAY.map((r) => r.value).sort()).toEqual([...CANCELLATION_REASONS].sort())
  })
})
