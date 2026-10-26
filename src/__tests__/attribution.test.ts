import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { captureAttribution, getAttribution } from '../utils/attribution'

describe('atribuição de tráfego', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('sem nada gravado, devolve null', () => {
    expect(getAttribution()).toBeNull()
  })

  it('grava os utm_* e o referrer da primeira chegada', () => {
    captureAttribution('?utm_source=instagram&utm_campaign=out', 'https://l.instagram.com/')
    expect(getAttribution()).toEqual({
      source: 'instagram',
      medium: null,
      campaign: 'out',
      content: null,
      term: null,
      referrer: 'https://l.instagram.com/',
    })
  })

  it('grava os cinco utm_* quando presentes', () => {
    captureAttribution('?utm_source=a&utm_medium=b&utm_campaign=c&utm_content=d&utm_term=e', '')
    expect(getAttribution()).toEqual({
      source: 'a',
      medium: 'b',
      campaign: 'c',
      content: 'd',
      term: 'e',
      referrer: null,
    })
  })

  it('segunda chamada sem UTM mantém a origem original', () => {
    captureAttribution('?utm_source=instagram&utm_campaign=out', '')
    captureAttribution('?foo=bar', 'https://example.com/')
    expect(getAttribution()?.source).toBe('instagram')
    expect(getAttribution()?.referrer).toBeNull()
  })

  it('sem UTM na primeira chamada, não grava nada', () => {
    captureAttribution('', 'https://example.com/')
    expect(getAttribution()).toBeNull()
  })

  it('um novo UTM substitui o anterior', () => {
    captureAttribution('?utm_source=instagram', '')
    captureAttribution('?utm_source=whatsapp', '')
    expect(getAttribution()?.source).toBe('whatsapp')
  })

  it('não quebra quando o sessionStorage não está disponível (modo privado)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => captureAttribution('?utm_source=instagram', '')).not.toThrow()
    expect(getAttribution()).toBeNull()
  })

  it('ignora conteúdo gravado que não é JSON válido', () => {
    sessionStorage.setItem('musa_attribution', '{quebrado')
    expect(getAttribution()).toBeNull()
  })
})
