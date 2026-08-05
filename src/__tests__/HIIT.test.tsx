import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HIIT from '../pages/HIIT'

describe('HIIT — configuração fantasma', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('carrega o vídeo padrão mesmo quando musa_hiit_url ficou vazia de uma sessão anterior', () => {
    // Resíduo de uma UI que existiu (agora removida) e gravava '' ao
    // "desvincular" o vídeo. Como '' !== null, a leitura antiga preferia
    // a string vazia ao DEFAULT_URL — a página ficava sem vídeo pra sempre,
    // sem nenhum caminho de recuperação pela interface.
    localStorage.setItem('musa_hiit_url', '')

    render(
      <MemoryRouter>
        <HIIT />
      </MemoryRouter>,
    )

    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('src')).toContain('oEPvWztSfk4')
    expect(screen.queryByText('Vídeo não disponível')).not.toBeInTheDocument()
  })

  it('limpa a chave órfã musa_hiit_url do dispositivo', () => {
    localStorage.setItem('musa_hiit_url', '')

    render(
      <MemoryRouter>
        <HIIT />
      </MemoryRouter>,
    )

    expect(localStorage.getItem('musa_hiit_url')).toBeNull()
  })

  it('carrega o vídeo padrão em um dispositivo sem nenhum resíduo', () => {
    render(
      <MemoryRouter>
        <HIIT />
      </MemoryRouter>,
    )

    const iframe = document.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toContain('oEPvWztSfk4')
  })
})
