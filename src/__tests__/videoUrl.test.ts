import { describe, it, expect } from 'vitest'
import { resolveVideoUrl } from '../utils/videoUrl'

const embed = (id: string) =>
  expect.stringContaining(`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&controls=1&vq=`)

describe('resolveVideoUrl', () => {
  it('link do botão Compartilhar (youtu.be) vira embed', () => {
    expect(resolveVideoUrl('https://youtu.be/abc123')).toEqual(embed('abc123'))
    expect(resolveVideoUrl('https://youtu.be/abc123?si=xyz')).toEqual(embed('abc123'))
  })

  it('watch?v= com parâmetros extras (&t=30) vira embed sem lixo', () => {
    const url = resolveVideoUrl('https://www.youtube.com/watch?v=abc123&t=30s')
    expect(url).toEqual(embed('abc123'))
    expect(url).not.toContain('&t=30s')
  })

  it('shorts e embed continuam funcionando', () => {
    expect(resolveVideoUrl('https://www.youtube.com/shorts/abc123')).toEqual(embed('abc123'))
    expect(resolveVideoUrl('https://www.youtube.com/embed/abc123')).toEqual(embed('abc123'))
  })

  it('link que não é do YouTube passa como está', () => {
    expect(resolveVideoUrl('https://cdn.exemplo.com/preparo.mp4')).toBe('https://cdn.exemplo.com/preparo.mp4')
    expect(resolveVideoUrl('https://vimeo.com/123')).toBe('https://vimeo.com/123')
  })

  it('texto que nem é URL não quebra', () => {
    expect(resolveVideoUrl('youtube')).toBe('youtube')
  })
})
