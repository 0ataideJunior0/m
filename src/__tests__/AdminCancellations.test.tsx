import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminCancellations from '../pages/admin/AdminCancellations'

vi.mock('../utils/adminCancellations', () => ({
  listCancellationFeedback: vi.fn(async () => [
    {
      id: 'f1',
      email: 'ana@example.com',
      reason: 'preco',
      reasonLabel: 'O preço',
      comment: 'Achei caro pro que uso',
      created_at: '2026-09-01T00:00:00.000Z',
    },
  ]),
}))

describe('AdminCancellations', () => {
  it('lista os motivos de cancelamento com o email, o rótulo e o comentário', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/cancellations']}>
        <Routes>
          <Route path="/admin/cancellations" element={<AdminCancellations />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('ana@example.com')).not.toBeNull()
    // "O preço" também aparece no resumo por categoria, então checa mais de uma ocorrência
    expect(screen.getAllByText('O preço').length).toBeGreaterThan(0)
    expect(screen.getByText('Achei caro pro que uso')).not.toBeNull()
  })

  it('mostra mensagem quando não há cancelamentos registrados', async () => {
    const { listCancellationFeedback } = await import('../utils/adminCancellations')
    vi.mocked(listCancellationFeedback).mockResolvedValueOnce([])

    render(
      <MemoryRouter initialEntries={['/admin/cancellations']}>
        <Routes>
          <Route path="/admin/cancellations" element={<AdminCancellations />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Nenhum cancelamento registrado ainda.')).not.toBeNull()
  })
})
