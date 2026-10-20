import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Play } from 'lucide-react'
import { getRecipe, recipeImageUrl } from '../utils/recipes'
import { splitLines } from '../utils/recipeFormat'
import { resolveVideoUrl } from '../utils/videoUrl'
import { Recipe } from '../types'
import { useDialogA11y } from '../hooks/useDialogA11y'
import ExerciseVideoModal from '../components/ExerciseVideoModal'
import PageHeader from '../components/ui/PageHeader'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [videoOpen, setVideoOpen] = useState(false)
  const [videoLoading, setVideoLoading] = useState(false)
  const videoDialogRef = useRef<HTMLDivElement>(null)

  const closeVideo = () => {
    setVideoOpen(false)
    setVideoLoading(false)
  }
  useDialogA11y(videoOpen, closeVideo, videoDialogRef)

  useEffect(() => {
    if (!id) return
    getRecipe(id).then((data) => {
      setRecipe(data)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">Receita não encontrada</h2>
          <button onClick={() => navigate('/receitas')} className="text-accent-text hover:opacity-80">
            Ver receitas
          </button>
        </div>
      </div>
    )
  }

  const image = recipeImageUrl(recipe.image_path)
  const ingredients = splitLines(recipe.ingredients)
  const steps = splitLines(recipe.steps)
  const macros = [
    recipe.calories !== null && `${recipe.calories} kcal`,
    recipe.protein_g !== null && `${recipe.protein_g}g proteína`,
    recipe.carbs_g !== null && `${recipe.carbs_g}g carboidratos`,
    recipe.fat_g !== null && `${recipe.fat_g}g gorduras`,
  ].filter((m): m is string => !!m)
  const videoUrl = recipe.video_url?.trim() ? resolveVideoUrl(recipe.video_url.trim()) : null

  return (
    <div className="min-h-screen bg-bg">
      {image && <img src={image} alt={recipe.title} className="w-full aspect-[4/3] max-h-96 object-cover bg-surface-sunken" />}

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <PageHeader title={recipe.title} onBack={() => navigate('/receitas')} />

        {macros.length > 0 && (
          <section aria-label="Macronutrientes" className="mb-6">
            <div className="flex flex-wrap gap-2">
              {macros.map((m) => (
                <span key={m} className="px-3 py-1.5 rounded-full bg-accent/15 text-accent-text text-sm font-extrabold">
                  {m}
                </span>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-2">Valores da receita inteira</p>
          </section>
        )}

        {videoUrl && (
          <Button
            className="w-full mb-6"
            onClick={() => {
              setVideoOpen(true)
              setVideoLoading(true)
            }}
          >
            <Play aria-hidden="true" className="w-4 h-4 mr-2" /> Ver preparo
          </Button>
        )}

        {ingredients.length > 0 && (
          <section className="bg-surface border border-border-card rounded-3xl shadow-sm p-5 mb-4">
            <h2 className="text-lg font-extrabold tracking-tight text-text-strong mb-3">Ingredientes</h2>
            <ul aria-label="Ingredientes" className="list-disc pl-5 space-y-1.5 text-text">
              {ingredients.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {steps.length > 0 && (
          <section className="bg-surface border border-border-card rounded-3xl shadow-sm p-5">
            <h2 className="text-lg font-extrabold tracking-tight text-text-strong mb-3">Modo de preparo</h2>
            <ol aria-label="Modo de preparo" className="list-decimal pl-5 space-y-2 text-text">
              {steps.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <ExerciseVideoModal
        open={videoOpen}
        videoUrl={videoUrl}
        videoTitle={`Preparo: ${recipe.title}`}
        videoLoading={videoLoading}
        onVideoLoaded={() => setVideoLoading(false)}
        onClose={closeVideo}
        dialogRef={videoDialogRef}
      />
    </div>
  )
}
