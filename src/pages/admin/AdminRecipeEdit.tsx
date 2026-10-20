import { ChangeEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ExternalLink, ImagePlus, Trash2 } from 'lucide-react'
import {
  createRecipeAdmin,
  deleteRecipeAdmin,
  getRecipeAdmin,
  removeRecipeImage,
  updateRecipeAdmin,
  uploadRecipeImage,
  RecipePayload,
} from '../../utils/adminRecipes'
import { recipeImageUrl } from '../../utils/recipes'
import { resizeToWebp } from '../../utils/imageResize'
import { splitLines } from '../../utils/recipeFormat'
import { isLikelyUrl } from '../../utils/workoutEditor'
import { Recipe } from '../../types'
import { cn } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import PageHeader from '../../components/ui/PageHeader'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import Toast from '../../components/ui/Toast'

interface Form {
  title: string
  calories: string
  protein: string
  carbs: string
  fat: string
  ingredients: string
  steps: string
  videoUrl: string
  published: boolean
  imagePath: string | null
}

const EMPTY: Form = {
  title: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  ingredients: '',
  steps: '',
  videoUrl: '',
  published: false,
  imagePath: null,
}

const toForm = (r: Recipe): Form => ({
  title: r.title,
  calories: r.calories === null ? '' : String(r.calories),
  protein: r.protein_g === null ? '' : String(r.protein_g),
  carbs: r.carbs_g === null ? '' : String(r.carbs_g),
  fat: r.fat_g === null ? '' : String(r.fat_g),
  ingredients: r.ingredients,
  steps: r.steps,
  videoUrl: r.video_url ?? '',
  published: r.published,
  imagePath: r.image_path,
})

/** "28,5" → 28.5; vazio → null; texto que não é número → NaN. */
const parseMacro = (raw: string): number | null => {
  const value = raw.trim().replace(',', '.')
  return value === '' ? null : Number(value)
}

const textareaClass =
  'w-full px-4 py-3 border border-border rounded-xl outline-none transition bg-surface-sunken text-text placeholder:text-text-placeholder focus:ring-2 focus:ring-focus-ring focus:border-transparent resize-y'

export default function AdminRecipeEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [savedForm, setSavedForm] = useState<Form>(EMPTY)
  const [loading, setLoading] = useState(!!id)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<'title' | 'calories' | 'protein' | 'carbs' | 'fat', string>>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm)
  const isNew = !recipe

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getRecipeAdmin(id)
      .then((data) => {
        if (!data) {
          setNotFound(true)
          return
        }
        setRecipe(data)
        setForm(toForm(data))
        setSavedForm(toForm(data))
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const blob = await resizeToWebp(file)
      const path = await uploadRecipeImage(blob)
      // Foto escolhida e ainda não salva que está sendo trocada de novo: some do bucket já.
      const previous = form.imagePath
      if (previous && previous !== savedForm.imagePath) removeRecipeImage(previous).catch(() => {})
      set('imagePath', path)
    } catch {
      showToast('Erro ao enviar a foto.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = useCallback(async () => {
    if (saving) return
    const found: typeof errors = {}
    if (!form.title.trim()) found.title = 'Dê um título à receita.'
    const macros = {
      calories: parseMacro(form.calories),
      protein: parseMacro(form.protein),
      carbs: parseMacro(form.carbs),
      fat: parseMacro(form.fat),
    }
    for (const key of ['calories', 'protein', 'carbs', 'fat'] as const) {
      const value = macros[key]
      if (value !== null && (Number.isNaN(value) || value < 0)) found[key] = 'Use só números.'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) {
      showToast('Corrija os campos destacados antes de salvar.')
      return
    }

    const payload: RecipePayload = {
      title: form.title.trim(),
      calories: macros.calories === null ? null : Math.round(macros.calories),
      protein_g: macros.protein,
      carbs_g: macros.carbs,
      fat_g: macros.fat,
      ingredients: form.ingredients,
      steps: form.steps,
      image_path: form.imagePath,
      video_url: form.videoUrl.trim() || null,
      published: form.published,
    }

    setSaving(true)
    try {
      const result = recipe ? await updateRecipeAdmin(recipe.id, payload) : await createRecipeAdmin(payload)
      // Só agora que a receita aponta pra foto nova é seguro apagar a antiga.
      if (recipe?.image_path && recipe.image_path !== payload.image_path) {
        removeRecipeImage(recipe.image_path).catch(() => {})
      }
      const next = toForm(result)
      setRecipe(result)
      setForm(next)
      setSavedForm(next)
      showToast(isNew ? 'Receita criada!' : 'Alterações salvas!', 'success')
      if (isNew) navigate(`/admin/recipes/${result.id}`, { replace: true })
    } catch (error: any) {
      showToast(`Erro ao salvar a receita. ${error?.message || ''}`)
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, form, recipe, isNew])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleDelete = async () => {
    if (!recipe) return
    setDeleting(true)
    try {
      await deleteRecipeAdmin(recipe)
      setSavedForm(form)
      navigate('/admin/recipes', { replace: true })
    } catch (error: any) {
      showToast(`Erro ao apagar a receita. ${error?.message || ''}`)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const goBack = () => (dirty ? setLeaveOpen(true) : navigate('/admin/recipes'))

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">Receita não encontrada</h2>
          <button onClick={() => navigate('/admin/recipes')} className="text-accent-text hover:opacity-80">
            Voltar às receitas
          </button>
        </div>
      </div>
    )
  }

  const imageUrl = recipeImageUrl(form.imagePath)
  const ingredients = splitLines(form.ingredients)
  const steps = splitLines(form.steps)
  const previewHasContent = ingredients.length > 0 || steps.length > 0

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-40">
        <PageHeader title={isNew ? 'Nova receita' : 'Editar receita'} onBack={goBack} />

        <section aria-labelledby="recipe-info" className="bg-surface border border-border-card rounded-3xl shadow-sm p-5 mb-6 space-y-4">
          <h2 id="recipe-info" className="text-lg font-extrabold tracking-tight text-text-strong">Informações</h2>
          <FormField label="Título" htmlFor="recipe-title" error={errors.title}>
            <Input
              id="recipe-title"
              type="text"
              maxLength={120}
              value={form.title}
              error={!!errors.title}
              placeholder="Ex.: Panqueca de banana e aveia"
              onChange={(e) => set('title', e.target.value)}
            />
          </FormField>

          <div>
            <span className="block text-sm font-medium text-text-muted mb-1">Foto do prato pronto</span>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Prévia da foto"
                className="w-full max-h-72 object-cover rounded-2xl mb-3 bg-surface-sunken"
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="recipe-photo"
                className={cn(
                  'inline-flex items-center px-4 py-2 rounded-full border border-border bg-surface text-sm font-medium text-text hover:bg-surface-hover cursor-pointer focus-within:ring-2 focus-within:ring-focus-ring',
                  uploading && 'opacity-60 pointer-events-none'
                )}
              >
                <ImagePlus aria-hidden="true" className="w-4 h-4 mr-1.5" />
                {uploading ? 'Enviando…' : imageUrl ? 'Trocar foto' : 'Escolher foto'}
                <input id="recipe-photo" type="file" accept="image/*" className="sr-only" onChange={handlePhoto} />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => set('imagePath', null)}
                  className="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 aria-hidden="true" className="w-4 h-4 mr-1.5" /> Remover foto
                </button>
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">A foto é reduzida automaticamente antes de subir.</p>
          </div>

          <FormField label="Link do vídeo do preparo (YouTube)" htmlFor="recipe-video">
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  id="recipe-video"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={form.videoUrl}
                  onChange={(e) => set('videoUrl', e.target.value)}
                />
              </div>
              {form.videoUrl.trim() && isLikelyUrl(form.videoUrl) && (
                <a
                  href={form.videoUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir vídeo em nova aba"
                  className="shrink-0 p-3 rounded-xl border border-border text-text hover:bg-surface-hover"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>
            {!isLikelyUrl(form.videoUrl) && (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">Isso não parece um link. Ele deve começar com https://</p>
            )}
          </FormField>
        </section>

        <section aria-labelledby="recipe-macros" className="bg-surface border border-border-card rounded-3xl shadow-sm p-5 mb-6">
          <h2 id="recipe-macros" className="text-lg font-extrabold tracking-tight text-text-strong">Macronutrientes</h2>
          <p className="text-sm text-text-muted mb-4">Valores da receita inteira, não por porção. Todos opcionais.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ['calories', 'Calorias (kcal)'],
                ['protein', 'Proteína (g)'],
                ['carbs', 'Carboidratos (g)'],
                ['fat', 'Gorduras (g)'],
              ] as const
            ).map(([key, label]) => (
              <FormField key={key} label={label} htmlFor={`recipe-${key}`} error={errors[key]}>
                <Input
                  id={`recipe-${key}`}
                  type="text"
                  inputMode="decimal"
                  value={form[key]}
                  error={!!errors[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </FormField>
            ))}
          </div>
        </section>

        <section aria-labelledby="recipe-text" className="bg-surface border border-border-card rounded-3xl shadow-sm p-5 mb-6 space-y-4">
          <h2 id="recipe-text" className="text-lg font-extrabold tracking-tight text-text-strong">Ingredientes e preparo</h2>
          <FormField label="Ingredientes" htmlFor="recipe-ingredients">
            <textarea
              id="recipe-ingredients"
              rows={6}
              className={textareaClass}
              placeholder={'2 ovos\n1 banana\n3 colheres de aveia'}
              value={form.ingredients}
              onChange={(e) => set('ingredients', e.target.value)}
            />
            <p className="text-xs text-text-muted mt-1">Um item por linha.</p>
          </FormField>
          <FormField label="Modo de preparo" htmlFor="recipe-steps">
            <textarea
              id="recipe-steps"
              rows={6}
              className={textareaClass}
              placeholder={'Amasse a banana\nMisture os ovos e a aveia\nFrite em fogo baixo'}
              value={form.steps}
              onChange={(e) => set('steps', e.target.value)}
            />
            <p className="text-xs text-text-muted mt-1">Um passo por linha — a aluna vê numerado.</p>
          </FormField>

          {previewHasContent && (
            <section aria-label="Prévia" className="rounded-2xl bg-surface-sunken p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">Como a aluna vai ver</p>
              {ingredients.length > 0 && (
                <ul className="list-disc pl-5 space-y-1 text-sm text-text mb-3">
                  {ingredients.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
              {steps.length > 0 && (
                <ol className="list-decimal pl-5 space-y-1 text-sm text-text">
                  {steps.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </section>

        <section className="bg-surface border border-border-card rounded-3xl shadow-sm p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2 id="recipe-published" className="font-extrabold text-text-strong">Publicada</h2>
              <p className="text-sm text-text-muted mt-0.5">
                {form.published ? 'As alunas já veem esta receita.' : 'Rascunho: só você vê esta receita.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.published}
              aria-labelledby="recipe-published"
              onClick={() => set('published', !form.published)}
              className={cn(
                'relative shrink-0 w-12 h-7 rounded-full transition focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2',
                form.published ? 'bg-accent' : 'bg-border'
              )}
            >
              <span
                aria-hidden="true"
                className={cn('absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform', form.published && 'translate-x-5')}
              />
            </button>
          </div>
        </section>

        {!isNew && (
          <div className="mt-10 pt-6 border-t border-border">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center text-sm font-bold text-red-600 dark:text-red-400 hover:opacity-80"
            >
              <Trash2 aria-hidden="true" className="w-4 h-4 mr-1" /> Apagar receita
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur border-t border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0 text-sm" aria-live="polite">
            <span className={cn('inline-flex items-center font-bold', dirty ? 'text-amber-700 dark:text-amber-400' : 'text-text-muted')}>
              {dirty ? (
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
              ) : (
                !isNew && <Check aria-hidden="true" className="w-4 h-4 mr-1" />
              )}
              {dirty ? (isNew ? 'Ainda não salva' : 'Alterações não salvas') : isNew ? 'Receita ainda não criada' : 'Tudo salvo'}
            </span>
            <span className="hidden sm:inline text-text-muted"> · Ctrl+S salva</span>
          </div>
          <Button onClick={handleSave} isLoading={saving} disabled={(!dirty && !isNew) || uploading}>
            {isNew ? 'Criar receita' : 'Salvar alterações'}
          </Button>
        </div>
      </div>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Sair sem salvar?"
        size="card"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setLeaveOpen(false)}>
              Continuar editando
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => navigate('/admin/recipes')}>
              Sair sem salvar
            </Button>
          </div>
        }
      >
        <p className="p-5 text-text">As alterações desta receita ainda não foram salvas e vão se perder.</p>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Apagar receita"
        size="card"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete} isLoading={deleting}>
              Apagar
            </Button>
          </div>
        }
      >
        <p className="p-5 text-text">“{recipe?.title}” será apagada, com a foto. Isso não pode ser desfeito.</p>
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
