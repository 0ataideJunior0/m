import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RecipeDetail from '../pages/RecipeDetail'

const getRecipeMock = vi.fn()

vi.mock('../utils/recipes', () => ({
  getRecipe: (...args: unknown[]) => getRecipeMock(...args),
  recipeImageUrl: (path: string | null) => (path ? `https://cdn.test/${path}` : null),
}))

const recipe = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  title: 'Panqueca de banana',
  calories: 320,
  protein_g: 28,
  carbs_g: 30,
  fat_g: 9,
  ingredients: '2 ovos\n\n1 banana\n  ',
  steps: 'Amasse a banana\nMisture os ovos\n\nFrite',
  image_path: 'recipes/a.webp',
  video_url: 'https://www.youtube.com/watch?v=abc123',
  sort_order: 0,
  published: true,
  created_at: '',
  updated_at: '',
  ...over,
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/receitas/r1']}>
      <Routes>
        <Route path="/receitas/:id" element={<RecipeDetail />} />
        <Route path="/receitas" element={<div>Lista de receitas</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => getRecipeMock.mockReset().mockResolvedValue(recipe()))

describe('RecipeDetail', () => {
  it('mostra a capa, os macros da receita inteira, ingredientes e preparo numerado', async () => {
    renderPage()

    const cover = await screen.findByRole('img', { name: 'Panqueca de banana' })
    expect(cover).toHaveAttribute('src', 'https://cdn.test/recipes/a.webp')
    expect(screen.getByText('Valores da receita inteira')).toBeInTheDocument()
    expect(screen.getByText('320 kcal')).toBeInTheDocument()
    expect(screen.getByText('28g proteína')).toBeInTheDocument()
    expect(screen.getByText('30g carboidratos')).toBeInTheDocument()
    expect(screen.getByText('9g gorduras')).toBeInTheDocument()

    const ingredients = within(screen.getByRole('list', { name: 'Ingredientes' })).getAllByRole('listitem')
    expect(ingredients.map((li) => li.textContent)).toEqual(['2 ovos', '1 banana'])

    const steps = within(screen.getByRole('list', { name: 'Modo de preparo' })).getAllByRole('listitem')
    expect(steps.map((li) => li.textContent)).toEqual(['Amasse a banana', 'Misture os ovos', 'Frite'])
    expect(screen.getByRole('list', { name: 'Modo de preparo' }).tagName).toBe('OL')
  })

  it('sem foto, sem vídeo e sem macros: não aparece <img>, botão de vídeo nem legenda de macros', async () => {
    getRecipeMock.mockResolvedValue(
      recipe({ image_path: null, video_url: null, calories: null, protein_g: null, carbs_g: null, fat_g: null })
    )
    renderPage()

    await screen.findByRole('heading', { name: 'Panqueca de banana' })
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: /ver preparo/i })).toBeNull()
    expect(screen.queryByText('Valores da receita inteira')).toBeNull()
  })

  it('"Ver preparo" abre o vídeo do YouTube no modal', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /ver preparo/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('iframe')?.getAttribute('src')).toContain('youtube.com/embed/abc123')
  })

  it('link que não é do YouTube chega ao modal como está', async () => {
    getRecipeMock.mockResolvedValue(recipe({ video_url: 'https://cdn.exemplo.com/preparo.mp4' }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /ver preparo/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('source')?.getAttribute('src')).toBe('https://cdn.exemplo.com/preparo.mp4')
  })

  it('receita inexistente mostra aviso e leva de volta à lista', async () => {
    getRecipeMock.mockResolvedValue(null)
    renderPage()

    expect(await screen.findByText('Receita não encontrada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver receitas' }))
    expect(await screen.findByText('Lista de receitas')).toBeInTheDocument()
  })
})
