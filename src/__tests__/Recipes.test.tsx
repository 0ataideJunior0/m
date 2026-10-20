import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Recipes from '../pages/Recipes'

const listRecipesMock = vi.fn()

vi.mock('../utils/recipes', () => ({
  listRecipes: (...args: unknown[]) => listRecipesMock(...args),
  recipeImageUrl: (path: string | null) => (path ? `https://cdn.test/${path}` : null),
}))

const recipe = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  title: 'Panqueca de banana',
  calories: 320,
  protein_g: 28,
  carbs_g: 30,
  fat_g: 9,
  ingredients: '',
  steps: '',
  image_path: 'recipes/a.webp',
  video_url: null,
  sort_order: 0,
  published: true,
  created_at: '',
  updated_at: '',
  ...over,
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/receitas']}>
      <Routes>
        <Route path="/receitas" element={<Recipes />} />
        <Route path="/receitas/:id" element={<div>Detalhe da receita</div>} />
        <Route path="/home" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => listRecipesMock.mockReset().mockResolvedValue([recipe()]))

describe('Recipes', () => {
  it('mostra título, macros e a miniatura de cada receita', async () => {
    const { container } = renderPage()

    expect(await screen.findByText('Panqueca de banana')).toBeInTheDocument()
    expect(screen.getByText('320 kcal · P 28g · C 30g · G 9g')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/recipes/a.webp')
  })

  it('receita sem foto e sem macros não deixa buraco: sem <img> e sem linha de macros', async () => {
    listRecipesMock.mockResolvedValue([
      recipe({ image_path: null, calories: null, protein_g: null, carbs_g: null, fat_g: null }),
    ])
    const { container } = renderPage()

    await screen.findByText('Panqueca de banana')
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText(/kcal|P \d/)).toBeNull()
  })

  it('lista vazia mostra a mensagem', async () => {
    listRecipesMock.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Nenhuma receita por aqui ainda.')).toBeInTheDocument()
  })

  it('tocar na receita abre o detalhe', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Panqueca de banana/ }))

    expect(await screen.findByText('Detalhe da receita')).toBeInTheDocument()
  })

  it('o botão de voltar leva pra Home', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Voltar' }))

    expect(await screen.findByText('Home Page')).toBeInTheDocument()
  })
})
