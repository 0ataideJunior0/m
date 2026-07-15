import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminDashboard from '../pages/admin/AdminDashboard'

describe('AdminDashboard', () => {
  it('navega para /admin/workouts ao clicar em Treinos', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/workouts" element={<div>Workouts Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Treinos'))
    expect(screen.getByText('Workouts Page')).not.toBeNull()
  })

  it('navega para /admin/users ao clicar em Usuárias', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<div>Users Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Usuárias'))
    expect(screen.getByText('Users Page')).not.toBeNull()
  })
})
