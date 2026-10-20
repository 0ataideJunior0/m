import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { listRecipes, recipeImageUrl } from '../utils/recipes'
import { macroSummary } from '../utils/recipeFormat'
import { Recipe } from '../types'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'

export default function Recipes() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listRecipes().then((data) => {
      setRecipes(data)
      setLoading(false)
    })
  }, [])

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
        <PageHeader title="Receitas fitness" onBack={() => navigate('/home')} />

        {recipes.length === 0 ? (
          <p className="text-text-muted text-center mt-12">Nenhuma receita por aqui ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recipes.map((recipe) => {
              const image = recipeImageUrl(recipe.image_path)
              const macros = macroSummary(recipe)
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/receitas/${recipe.id}`)}
                    className="w-full flex items-center gap-3 text-left bg-surface border border-border-card rounded-3xl shadow-sm p-3 hover:shadow-lg transition focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  >
                    {image && (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="w-16 h-16 shrink-0 rounded-2xl object-cover bg-surface-sunken"
                      />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block font-extrabold text-text-strong">{recipe.title}</span>
                      {macros && <span className="block text-sm text-text-muted mt-0.5">{macros}</span>}
                    </span>
                    <ChevronRight aria-hidden="true" className="w-5 h-5 text-text-muted shrink-0" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
