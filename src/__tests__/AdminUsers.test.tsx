import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminUsers from '../pages/admin/AdminUsers'

vi.mock('../utils/adminUsers', () => ({
  listNonAdminUsers: vi.fn(async () => ([
    { id: 'u1', email: 'ana@example.com', username: 'Ana', created_at: '2026-01-01T00:00:00.000Z', completedDays: 5 },
  ])),
}))

describe('AdminUsers', () => {
  it('lista usuárias com progresso', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<AdminUsers />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('ana@example.com')).not.toBeNull()
    expect(screen.getByText('5/30')).not.toBeNull()
  })
})
