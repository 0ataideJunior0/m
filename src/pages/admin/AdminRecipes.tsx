import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronRight, Plus } from 'lucide-react'
import { listRecipesAdmin, swapRecipeOrderAdmin } from '../../utils/adminRecipes'
import { recipeImageUrl } from '../../utils/recipes'
import { macroSummary } from '../../utils/recipeFormat'
import { Recipe } from '../../types'
import { useToast } from '../../hooks/useToast'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Toast from '../../components/ui/Toast'

export default function AdminRecipes() {
  const navigate = useNavigate()
  const { toast, show: showToast, dismiss: dismissToast } = useToast()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    listRecipesAdmin()
      .then(setRecipes)
      .catch(() => showToast('Não foi possível carregar as receitas.'))
      .finally(() => setLoading(false))
  }, [])

  const move = async (index: number, direction: -1 | 1) => {
    const a = recipes[index]
    const b = recipes[index + direction]
    if (!a || !b || moving) return
    setMoving(true)
    try {
      await swapRecipeOrderAdmin(a, b)
      const next = [...recipes]
      next[index] = { ...b, sort_order: a.sort_order }
      next[index + direction] = { ...a, sort_order: b.sort_order }
      setRecipes(next.sort((x, y) => x.sort_order - y.sort_order))
    } catch {
      showToast('Erro ao reordenar. Tente de novo.')
    } finally {
      setMoving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">
        <PageHeader
          title="Receitas"
          onBack={() => navigate('/admin')}
          right={
            <Button size="sm" onClick={() => navigate('/admin/recipes/nova')}>
              <Plus className="w-4 h-4 mr-1" /> Nova receita
            </Button>
          }
        />

        {recipes.length === 0 ? (
          <p className="text-text-muted text-center mt-12">Nenhuma receita cadastrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recipes.map((recipe, index) => {
              const image = recipeImageUrl(recipe.image_path)
              const macros = macroSummary(recipe)
              return (
                <li key={recipe.id} className="flex items-center gap-1 bg-surface border border-border-card rounded-2xl shadow-sm p-2 pl-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/recipes/${recipe.id}`)}
                    aria-label={`Editar ${recipe.title}`}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-xl p-1 hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  >
                    {image && <img src={image} alt="" loading="lazy" className="w-12 h-12 shrink-0 rounded-xl object-cover bg-surface-sunken" />}
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-bold text-text-strong truncate">{recipe.title}</span>
                        {!recipe.published && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-bold">
                            Rascunho
                          </span>
                        )}
                      </span>
                      {macros && <span className="block text-xs text-text-muted truncate">{macros}</span>}
                    </span>
                    <ChevronRight aria-hidden="true" className="w-5 h-5 text-text-muted shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || moving}
                    aria-label={`Mover ${recipe.title} para cima`}
                    className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-full text-text-muted hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === recipes.length - 1 || moving}
                    aria-label={`Mover ${recipe.title} para baixo`}
                    className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-full text-text-muted hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
