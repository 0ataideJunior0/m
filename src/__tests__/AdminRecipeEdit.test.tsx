import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminRecipeEdit from '../pages/admin/AdminRecipeEdit'

const getRecipeAdminMock = vi.fn()
const createRecipeAdminMock = vi.fn()
const updateRecipeAdminMock = vi.fn()
const deleteRecipeAdminMock = vi.fn(async () => {})
const uploadRecipeImageMock = vi.fn()
const removeRecipeImageMock = vi.fn(async () => {})
const resizeToWebpMock = vi.fn()

vi.mock('../utils/adminRecipes', () => ({
  getRecipeAdmin: (...args: unknown[]) => getRecipeAdminMock(...args),
  createRecipeAdmin: (...args: unknown[]) => createRecipeAdminMock(...args),
  updateRecipeAdmin: (...args: unknown[]) => updateRecipeAdminMock(...args),
  deleteRecipeAdmin: (...args: unknown[]) => deleteRecipeAdminMock(...args),
  uploadRecipeImage: (...args: unknown[]) => uploadRecipeImageMock(...args),
  removeRecipeImage: (...args: unknown[]) => removeRecipeImageMock(...args),
}))

vi.mock('../utils/imageResize', () => ({
  resizeToWebp: (...args: unknown[]) => resizeToWebpMock(...args),
}))

vi.mock('../utils/recipes', () => ({
  recipeImageUrl: (path: string | null) => (path ? `https://cdn.test/${path}` : null),
}))

const saved = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  title: 'Panqueca',
  calories: 320,
  protein_g: 28,
  carbs_g: 30,
  fat_g: 9,
  ingredients: '2 ovos\n1 banana',
  steps: 'Bata\nFrite',
  image_path: 'recipes/old.webp',
  video_url: 'https://youtu.be/abc',
  sort_order: 0,
  published: false,
  created_at: '',
  updated_at: '',
  ...over,
})

const renderNew = () =>
  render(
    <MemoryRouter initialEntries={['/admin/recipes/nova']}>
      <Routes>
        <Route path="/admin/recipes/nova" element={<AdminRecipeEdit />} />
        <Route path="/admin/recipes/:id" element={<AdminRecipeEdit />} />
        <Route path="/admin/recipes" element={<div>Lista Page</div>} />
      </Routes>
    </MemoryRouter>
  )

const renderExisting = () =>
  render(
    <MemoryRouter initialEntries={['/admin/recipes/r1']}>
      <Routes>
        <Route path="/admin/recipes/nova" element={<AdminRecipeEdit />} />
        <Route path="/admin/recipes/:id" element={<AdminRecipeEdit />} />
        <Route path="/admin/recipes" element={<div>Lista Page</div>} />
      </Routes>
    </MemoryRouter>
  )

const photo = () => new File(['x'], 'prato.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  getRecipeAdminMock.mockReset().mockResolvedValue(saved())
  createRecipeAdminMock.mockReset().mockResolvedValue(saved({ id: 'novo' }))
  updateRecipeAdminMock.mockReset().mockImplementation(async (_id: string, p: object) => saved(p))
  deleteRecipeAdminMock.mockClear()
  removeRecipeImageMock.mockReset().mockResolvedValue(undefined)
  resizeToWebpMock.mockReset().mockResolvedValue(new Blob(['w'], { type: 'image/webp' }))
  uploadRecipeImageMock.mockReset().mockResolvedValue('recipes/new.webp')
})

describe('AdminRecipeEdit — receita nova', () => {
  it('não salva sem título e avisa', async () => {
    renderNew()

    fireEvent.click(await screen.findByRole('button', { name: 'Criar receita' }))

    expect(await screen.findByText('Dê um título à receita.')).toBeInTheDocument()
    expect(createRecipeAdminMock).not.toHaveBeenCalled()
  })

  it('cria como rascunho, com macros vazios como null e vírgula decimal convertida', async () => {
    renderNew()

    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Panqueca' } })
    fireEvent.change(screen.getByLabelText('Proteína (g)'), { target: { value: '28,5' } })
    fireEvent.change(screen.getByLabelText('Ingredientes'), { target: { value: '2 ovos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar receita' }))

    await waitFor(() =>
      expect(createRecipeAdminMock).toHaveBeenCalledWith({
        title: 'Panqueca',
        calories: null,
        protein_g: 28.5,
        carbs_g: null,
        fat_g: null,
        ingredients: '2 ovos',
        steps: '',
        image_path: null,
        video_url: null,
        published: false,
      })
    )
  })

  it('macro que não é número bloqueia o salvamento', async () => {
    renderNew()

    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Panqueca' } })
    fireEvent.change(screen.getByLabelText('Calorias (kcal)'), { target: { value: 'muitas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar receita' }))

    expect(await screen.findByText('Use só números.')).toBeInTheDocument()
    expect(createRecipeAdminMock).not.toHaveBeenCalled()
  })

  it('o interruptor Publicada entra no payload', async () => {
    renderNew()

    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Panqueca' } })
    fireEvent.click(screen.getByRole('switch', { name: 'Publicada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar receita' }))

    await waitFor(() => expect(createRecipeAdminMock).toHaveBeenCalledWith(expect.objectContaining({ published: true })))
  })

  it('a prévia mostra ingredientes e preparo como a aluna vai ver', async () => {
    renderNew()

    fireEvent.change(await screen.findByLabelText('Ingredientes'), { target: { value: '2 ovos\n\n1 banana' } })
    fireEvent.change(screen.getByLabelText('Modo de preparo'), { target: { value: 'Bata\nFrite' } })

    const preview = screen.getByRole('region', { name: 'Prévia' })
    expect(within(preview).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['2 ovos', '1 banana', 'Bata', 'Frite'])
  })

  it('escolher a foto reduz, sobe e mostra a prévia', async () => {
    renderNew()

    fireEvent.change(await screen.findByLabelText('Escolher foto'), { target: { files: [photo()] } })

    await waitFor(() => expect(uploadRecipeImageMock).toHaveBeenCalledWith(expect.any(Blob)))
    expect(resizeToWebpMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('img', { name: 'Prévia da foto' })).toHaveAttribute('src', 'https://cdn.test/recipes/new.webp')
  })

  it('se o upload da foto falhar, avisa e não perde o que foi digitado', async () => {
    uploadRecipeImageMock.mockRejectedValueOnce(new Error('rede'))
    renderNew()

    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Panqueca' } })
    fireEvent.change(screen.getByLabelText('Escolher foto'), { target: { files: [photo()] } })

    expect(await screen.findByText('Erro ao enviar a foto.')).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Panqueca')
    expect(screen.queryByRole('img', { name: 'Prévia da foto' })).toBeNull()
  })

  it('arquivo que não é imagem é recusado com o mesmo aviso', async () => {
    resizeToWebpMock.mockRejectedValueOnce(new Error('Arquivo não é uma imagem'))
    renderNew()

    fireEvent.change(await screen.findByLabelText('Escolher foto'), {
      target: { files: [new File(['x'], 'nota.txt', { type: 'text/plain' })] },
    })

    expect(await screen.findByText('Erro ao enviar a foto.')).toBeInTheDocument()
    expect(uploadRecipeImageMock).not.toHaveBeenCalled()
  })

  it('sair com alterações pede confirmação', async () => {
    renderNew()

    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Panqueca' } })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))

    expect(screen.getByText('Sair sem salvar?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }))
    expect(await screen.findByText('Lista Page')).toBeInTheDocument()
  })
})

describe('AdminRecipeEdit — Ctrl+S durante o envio da foto', () => {
  it('não salva enquanto a foto ainda está subindo (senão a receita pode apontar pra uma foto descartada)', async () => {
    let finishUpload: (path: string) => void = () => {}
    uploadRecipeImageMock.mockReturnValueOnce(new Promise<string>((resolve) => (finishUpload = resolve)))
    renderExisting()

    fireEvent.change(await screen.findByLabelText('Trocar foto'), { target: { files: [photo()] } })
    await waitFor(() => expect(uploadRecipeImageMock).toHaveBeenCalled())
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    expect(updateRecipeAdminMock).not.toHaveBeenCalled()

    finishUpload('recipes/new.webp')
    await screen.findByRole('img', { name: 'Prévia da foto' })
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    await waitFor(() => expect(updateRecipeAdminMock).toHaveBeenCalledWith('r1', expect.objectContaining({ image_path: 'recipes/new.webp' })))
  })
})

describe('AdminRecipeEdit — receita existente', () => {
  it('carrega os dados, com a foto atual', async () => {
    renderExisting()

    expect(await screen.findByDisplayValue('Panqueca')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Prévia da foto' })).toHaveAttribute('src', 'https://cdn.test/recipes/old.webp')
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()
  })

  it('trocar a foto só apaga a antiga do bucket depois que a receita salvou', async () => {
    const order: string[] = []
    updateRecipeAdminMock.mockImplementation(async (_id: string, p: object) => {
      order.push('update')
      return saved(p)
    })
    removeRecipeImageMock.mockImplementation(async (path: string) => {
      order.push(`remove:${path}`)
    })
    renderExisting()

    fireEvent.change(await screen.findByLabelText('Trocar foto'), { target: { files: [photo()] } })
    await screen.findByRole('img', { name: 'Prévia da foto' })
    expect(removeRecipeImageMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(order).toEqual(['update', 'remove:recipes/old.webp']))
    expect(updateRecipeAdminMock).toHaveBeenCalledWith('r1', expect.objectContaining({ image_path: 'recipes/new.webp' }))
  })

  it('remover a foto também só apaga o arquivo depois de salvar', async () => {
    renderExisting()

    fireEvent.click(await screen.findByRole('button', { name: 'Remover foto' }))
    expect(removeRecipeImageMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(updateRecipeAdminMock).toHaveBeenCalledWith('r1', expect.objectContaining({ image_path: null })))
    await waitFor(() => expect(removeRecipeImageMock).toHaveBeenCalledWith('recipes/old.webp'))
  })

  it('apagar a receita pede confirmação e volta pra lista', async () => {
    renderExisting()

    fireEvent.click(await screen.findByRole('button', { name: 'Apagar receita' }))
    expect(deleteRecipeAdminMock).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Apagar' }))

    await waitFor(() => expect(deleteRecipeAdminMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' })))
    expect(await screen.findByText('Lista Page')).toBeInTheDocument()
  })

  it('receita inexistente mostra aviso', async () => {
    getRecipeAdminMock.mockResolvedValue(null)
    renderExisting()

    expect(await screen.findByText('Receita não encontrada')).toBeInTheDocument()
  })
})
