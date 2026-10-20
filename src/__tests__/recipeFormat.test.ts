import { describe, it, expect } from 'vitest'
import { macroSummary, splitLines, fitWithin } from '../utils/recipeFormat'

describe('macroSummary', () => {
  it('junta calorias, proteína, carboidratos e gorduras', () => {
    expect(macroSummary({ calories: 320, protein_g: 28, carbs_g: 30, fat_g: 9 })).toBe('320 kcal · P 28g · C 30g · G 9g')
  })

  it('omite o que estiver vazio, mas mantém o zero', () => {
    expect(macroSummary({ calories: null, protein_g: 12.5, carbs_g: null, fat_g: 0 })).toBe('P 12.5g · G 0g')
  })

  it('sem nenhum macro devolve texto vazio', () => {
    expect(macroSummary({ calories: null, protein_g: null, carbs_g: null, fat_g: null })).toBe('')
  })
})

describe('splitLines', () => {
  it('corta por linha, tira espaços e descarta linhas vazias', () => {
    expect(splitLines('  2 ovos \n\n 1 banana\r\n   \n')).toEqual(['2 ovos', '1 banana'])
  })

  it('texto vazio não vira item', () => {
    expect(splitLines('')).toEqual([])
  })
})

describe('fitWithin', () => {
  it('reduz mantendo a proporção', () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 })
  })

  it('nunca aumenta uma imagem pequena', () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 })
  })
})
