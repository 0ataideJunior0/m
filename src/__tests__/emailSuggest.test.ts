import { describe, it, expect } from 'vitest'
import { suggestEmail } from '../utils/emailSuggest'

describe('suggestEmail', () => {
  it('corrige domínio digitado errado', () => {
    expect(suggestEmail('ana@gmial.com')).toBe('ana@gmail.com')
  })

  it.each([
    ['gmial.com', 'gmail.com'],
    ['gmai.com', 'gmail.com'],
    ['gmal.com', 'gmail.com'],
    ['gmail.co', 'gmail.com'],
    ['gmail.con', 'gmail.com'],
    ['hotmial.com', 'hotmail.com'],
    ['hotmal.com', 'hotmail.com'],
    ['hotmail.co', 'hotmail.com'],
    ['outlok.com', 'outlook.com'],
    ['yahoo.com.b', 'yahoo.com.br'],
    ['icloud.co', 'icloud.com'],
  ])('corrige @%s para @%s', (wrong, right) => {
    expect(suggestEmail(`ana@${wrong}`)).toBe(`ana@${right}`)
  })

  it('não sugere nada para e-mail correto', () => {
    expect(suggestEmail('ana@gmail.com')).toBeNull()
    expect(suggestEmail('ana@empresa.com.br')).toBeNull()
  })

  it('ignora maiúsculas e espaços ao redor, e preserva a parte local', () => {
    expect(suggestEmail('  Ana.Silva@GMIAL.com ')).toBe('Ana.Silva@gmail.com')
  })

  it('devolve null para entrada sem domínio', () => {
    expect(suggestEmail('')).toBeNull()
    expect(suggestEmail('ana')).toBeNull()
    expect(suggestEmail('ana@')).toBeNull()
    expect(suggestEmail('@gmial.com')).toBeNull()
  })
})
