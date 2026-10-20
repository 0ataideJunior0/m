import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fromMock, storageFromMock, getPublicUrlMock } = vi.hoisted(() => {
  const getPublicUrlMock = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/recipe-images/${path}` } }))
  return {
    fromMock: vi.fn(),
    getPublicUrlMock,
    storageFromMock: vi.fn(() => ({ getPublicUrl: getPublicUrlMock })),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, storage: { from: storageFromMock } },
}))

import { listRecipes, getRecipe, recipeImageUrl } from '../utils/recipes'

/** Query encadeável que resolve `result` em qualquer ponto da cadeia. */
const fakeQuery = (result: unknown) => {
  const q: any = {}
  for (const m of ['select', 'eq', 'order', 'maybeSingle']) q[m] = vi.fn(() => q)
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
  return q
}

beforeEach(() => {
  fromMock.mockReset()
  storageFromMock.mockClear()
  getPublicUrlMock.mockClear()
})

describe('listRecipes', () => {
  it('lista só as publicadas, na ordem definida pela admin', async () => {
    const q = fakeQuery({ data: [{ id: 'r1', title: 'Panqueca' }], error: null })
    fromMock.mockReturnValueOnce(q)

    const result = await listRecipes()

    expect(fromMock).toHaveBeenCalledWith('recipes')
    expect(q.eq).toHaveBeenCalledWith('published', true)
    expect(q.order).toHaveBeenCalledWith('sort_order', { ascending: true })
    expect(result).toHaveLength(1)
  })

  it('devolve lista vazia quando a consulta falha', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: new Error('boom') }))

    expect(await listRecipes()).toEqual([])
  })
})

describe('getRecipe', () => {
  it('busca a receita pelo id', async () => {
    const q = fakeQuery({ data: { id: 'r1', title: 'Panqueca' }, error: null })
    fromMock.mockReturnValueOnce(q)

    const recipe = await getRecipe('r1')

    expect(q.eq).toHaveBeenCalledWith('id', 'r1')
    expect(recipe?.title).toBe('Panqueca')
  })

  it('receita inexistente (ou rascunho, que a RLS esconde) volta null', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: null }))

    expect(await getRecipe('nada')).toBeNull()
  })

  it('devolve null quando a consulta falha', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: new Error('boom') }))

    expect(await getRecipe('r1')).toBeNull()
  })
})

describe('recipeImageUrl', () => {
  it('sem foto devolve null e não consulta o storage', () => {
    expect(recipeImageUrl(null)).toBeNull()
    expect(storageFromMock).not.toHaveBeenCalled()
  })

  it('com foto devolve a URL pública do bucket de receitas', () => {
    expect(recipeImageUrl('recipes/a.webp')).toBe('https://cdn.test/recipe-images/recipes/a.webp')
    expect(storageFromMock).toHaveBeenCalledWith('recipe-images')
  })
})
