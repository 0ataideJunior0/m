import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminRecipes from '../pages/admin/AdminRecipes'

const listRecipesAdminMock = vi.fn()
const swapRecipeOrderAdminMock = vi.fn(async () => {})

vi.mock('../utils/adminRecipes', () => ({
  listRecipesAdmin: (...args: unknown[]) => listRecipesAdminMock(...args),
  swapRecipeOrderAdmin: (...args: unknown[]) => swapRecipeOrderAdminMock(...args),
}))

vi.mock('../utils/recipes', () => ({
  recipeImageUrl: (path: string | null) => (path ? `https://cdn.test/${path}` : null),
}))

const recipe = (id: string, title: string, sort_order: number, published = true) => ({
  id,
  title,
  calories: 300,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  ingredients: '',
  steps: '',
  image_path: null,
  video_url: null,
  sort_order,
  published,
  created_at: '',
  updated_at: '',
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/recipes']}>
      <Routes>
        <Route path="/admin/recipes" element={<AdminRecipes />} />
        <Route path="/admin/recipes/nova" element={<div>Nova receita Page</div>} />
        <Route path="/admin/recipes/:id" element={<div>Editor Page</div>} />
        <Route path="/admin" element={<div>Painel Page</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  swapRecipeOrderAdminMock.mockClear()
  listRecipesAdminMock.mockReset().mockResolvedValue([recipe('a', 'Panqueca', 0), recipe('b', 'Omelete', 1, false)])
})

describe('AdminRecipes', () => {
  it('lista todas as receitas e marca os rascunhos', async () => {
    renderPage()

    expect(await screen.findByText('Panqueca')).toBeInTheDocument()
    const draftRow = screen.getByText('Omelete').closest('li')!
    expect(within(draftRow).getByText('Rascunho')).toBeInTheDocument()
    expect(within(screen.getByText('Panqueca').closest('li')!).queryByText('Rascunho')).toBeNull()
  })

  it('"Nova receita" abre o editor em branco', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /nova receita/i }))

    expect(await screen.findByText('Nova receita Page')).toBeInTheDocument()
  })

  it('tocar numa receita abre o editor dela', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Panqueca' }))

    expect(await screen.findByText('Editor Page')).toBeInTheDocument()
  })

  it('a seta troca a posição das duas receitas e a lista já reordena', async () => {
    renderPage()
    await screen.findByText('Panqueca')

    fireEvent.click(screen.getByRole('button', { name: 'Mover Panqueca para baixo' }))

    await waitFor(() => expect(swapRecipeOrderAdminMock).toHaveBeenCalledTimes(1))
    const [a, b] = swapRecipeOrderAdminMock.mock.calls[0] as unknown as [{ id: string }, { id: string }]
    expect([a.id, b.id]).toEqual(['a', 'b'])
    await waitFor(() => {
      const titles = screen.getAllByRole('listitem').map((li) => li.textContent)
      expect(titles[0]).toContain('Omelete')
      expect(titles[1]).toContain('Panqueca')
    })
  })

  it('as setas das pontas ficam desabilitadas', async () => {
    renderPage()
    await screen.findByText('Panqueca')

    expect(screen.getByRole('button', { name: 'Mover Panqueca para cima' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mover Omelete para baixo' })).toBeDisabled()
  })

  it('sem receitas, convida a criar a primeira', async () => {
    listRecipesAdminMock.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Nenhuma receita cadastrada ainda.')).toBeInTheDocument()
  })
})
