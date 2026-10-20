import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fromMock, storageFromMock, uploadMock, removeMock } = vi.hoisted(() => {
  const uploadMock = vi.fn()
  const removeMock = vi.fn()
  return {
    fromMock: vi.fn(),
    uploadMock,
    removeMock,
    storageFromMock: vi.fn(() => ({ upload: uploadMock, remove: removeMock })),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, storage: { from: storageFromMock } },
}))

import {
  listRecipesAdmin,
  createRecipeAdmin,
  updateRecipeAdmin,
  deleteRecipeAdmin,
  swapRecipeOrderAdmin,
  uploadRecipeImage,
  removeRecipeImage,
  RecipePayload,
} from '../utils/adminRecipes'
import type { Recipe } from '../types'

/** Query encadeável que resolve `result` em qualquer ponto da cadeia. */
const fakeQuery = (result: unknown) => {
  const q: any = {}
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete', 'maybeSingle', 'single']) {
    q[m] = vi.fn(() => q)
  }
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
  return q
}

const payload: RecipePayload = {
  title: 'Panqueca',
  calories: 320,
  protein_g: 28,
  carbs_g: 30,
  fat_g: 9,
  ingredients: '2 ovos',
  steps: 'Bata tudo',
  image_path: null,
  video_url: null,
  published: false,
}

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: 'r1',
  sort_order: 0,
  created_at: '',
  updated_at: '',
  ...payload,
  ...over,
})

beforeEach(() => {
  fromMock.mockReset()
  storageFromMock.mockClear()
  uploadMock.mockReset().mockResolvedValue({ error: null })
  removeMock.mockReset().mockResolvedValue({ error: null })
})

describe('listRecipesAdmin', () => {
  it('lista todas (rascunhos também) por ordem', async () => {
    const q = fakeQuery({ data: [recipe(), recipe({ id: 'r2' })], error: null })
    fromMock.mockReturnValueOnce(q)

    const result = await listRecipesAdmin()

    expect(q.order).toHaveBeenCalledWith('sort_order', { ascending: true })
    expect(result).toHaveLength(2)
  })

  it('lança erro quando a consulta falha', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: new Error('boom') }))

    await expect(listRecipesAdmin()).rejects.toThrow('boom')
  })
})

describe('createRecipeAdmin', () => {
  it('coloca a nova receita no fim da lista (último sort_order + 1)', async () => {
    const last = fakeQuery({ data: { sort_order: 4 }, error: null })
    const insert = fakeQuery({ data: recipe({ id: 'novo', sort_order: 5 }), error: null })
    fromMock.mockReturnValueOnce(last).mockReturnValueOnce(insert)

    const created = await createRecipeAdmin(payload)

    expect(last.order).toHaveBeenCalledWith('sort_order', { ascending: false })
    expect(insert.insert).toHaveBeenCalledWith({ ...payload, sort_order: 5 })
    expect(created.id).toBe('novo')
  })

  it('primeira receita da lista começa em 0', async () => {
    const last = fakeQuery({ data: null, error: null })
    const insert = fakeQuery({ data: recipe({ id: 'novo' }), error: null })
    fromMock.mockReturnValueOnce(last).mockReturnValueOnce(insert)

    await createRecipeAdmin(payload)

    expect(insert.insert).toHaveBeenCalledWith({ ...payload, sort_order: 0 })
  })
})

describe('updateRecipeAdmin', () => {
  it('atualiza pelo id e grava updated_at', async () => {
    const q = fakeQuery({ data: recipe(), error: null })
    fromMock.mockReturnValueOnce(q)

    await updateRecipeAdmin('r1', payload)

    expect(q.update).toHaveBeenCalledWith(expect.objectContaining({ ...payload, updated_at: expect.any(String) }))
    expect(q.eq).toHaveBeenCalledWith('id', 'r1')
  })
})

describe('swapRecipeOrderAdmin', () => {
  it('troca os sort_order das duas receitas', async () => {
    const first = fakeQuery({ error: null })
    const second = fakeQuery({ error: null })
    fromMock.mockReturnValueOnce(first).mockReturnValueOnce(second)

    await swapRecipeOrderAdmin(recipe({ id: 'a', sort_order: 1 }), recipe({ id: 'b', sort_order: 2 }))

    expect(first.update).toHaveBeenCalledWith({ sort_order: 2 })
    expect(first.eq).toHaveBeenCalledWith('id', 'a')
    expect(second.update).toHaveBeenCalledWith({ sort_order: 1 })
    expect(second.eq).toHaveBeenCalledWith('id', 'b')
  })
})

describe('deleteRecipeAdmin', () => {
  it('apaga a linha antes da foto', async () => {
    const order: string[] = []
    const q = fakeQuery({ error: null })
    q.eq = vi.fn(() => {
      order.push('row')
      return q
    })
    removeMock.mockImplementation(async () => {
      order.push('image')
      return { error: null }
    })
    fromMock.mockReturnValueOnce(q)

    await deleteRecipeAdmin(recipe({ image_path: 'recipes/a.webp' }))

    expect(order).toEqual(['row', 'image'])
    expect(removeMock).toHaveBeenCalledWith(['recipes/a.webp'])
  })

  it('se apagar a foto falhar, a receita já foi apagada e não lança', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ error: null }))
    removeMock.mockRejectedValueOnce(new Error('storage fora'))

    await expect(deleteRecipeAdmin(recipe({ image_path: 'recipes/a.webp' }))).resolves.toBeUndefined()
  })

  it('receita sem foto não mexe no storage', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ error: null }))

    await deleteRecipeAdmin(recipe())

    expect(storageFromMock).not.toHaveBeenCalled()
  })
})

describe('uploadRecipeImage', () => {
  it('sobe como WebP em recipes/<id>.webp e devolve o caminho', async () => {
    const path = await uploadRecipeImage(new Blob(['x'], { type: 'image/webp' }))

    expect(path).toMatch(/^recipes\/.+\.webp$/)
    expect(storageFromMock).toHaveBeenCalledWith('recipe-images')
    expect(uploadMock).toHaveBeenCalledWith(path, expect.any(Blob), { contentType: 'image/webp' })
  })

  it('lança erro quando o upload falha', async () => {
    uploadMock.mockResolvedValueOnce({ error: new Error('sem espaço') })

    await expect(uploadRecipeImage(new Blob(['x']))).rejects.toThrow('sem espaço')
  })
})

describe('removeRecipeImage', () => {
  it('remove o arquivo do bucket', async () => {
    await removeRecipeImage('recipes/a.webp')

    expect(removeMock).toHaveBeenCalledWith(['recipes/a.webp'])
  })
})
