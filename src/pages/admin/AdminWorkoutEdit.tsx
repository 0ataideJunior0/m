import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react'
import { getWorkoutByDay } from '../../utils/workouts'
import { updateWorkoutAdmin } from '../../utils/adminWorkouts'
import { Exercise } from '../../types'

const EMPTY_EXERCISE: Exercise = { exercise: '', reps: '', sets: '', note: '', group: '', type: 'normal', video: '' }

export default function AdminWorkoutEdit() {
  const { day } = useParams<{ day: string }>()
  const navigate = useNavigate()
  const dayNumber = parseInt(day || '1')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])

  useEffect(() => {
    load()
  }, [dayNumber])

  const load = async () => {
    setLoading(true)
    try {
      const workout = await getWorkoutByDay(dayNumber)
      if (workout) {
        setTitle(workout.title)
        setVideoUrl(workout.video_url || '')
        setExercises(workout.exercises || [])
      }
    } catch (error) {
      console.error('Error loading workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateExercise = (index: number, patch: Partial<Exercise>) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    setExercises((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

  const addExercise = () => {
    setExercises((prev) => [...prev, { ...EMPTY_EXERCISE }])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateWorkoutAdmin(dayNumber, { title, video_url: videoUrl, exercises })
      alert('Treino atualizado com sucesso!')
    } catch (error: any) {
      alert(`Erro ao salvar treino. ${error?.message || ''}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/admin/workouts')} className="mr-4 p-2 rounded-lg hover:bg-white/50 transition">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Editar Dia {dayNumber}</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="workout-title">Título</label>
            <input
              id="workout-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="workout-video">Vídeo do dia (URL)</label>
            <input
              id="workout-video"
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Exercícios</h2>
          <div className="space-y-4">
            {exercises.map((ex, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">Exercício {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => moveExercise(index, -1)} aria-label="Mover para cima" className="p-1 rounded hover:bg-gray-100">
                      <ArrowUp className="w-4 h-4 text-gray-600" />
                    </button>
                    <button type="button" onClick={() => moveExercise(index, 1)} aria-label="Mover para baixo" className="p-1 rounded hover:bg-gray-100">
                      <ArrowDown className="w-4 h-4 text-gray-600" />
                    </button>
                    <button type="button" onClick={() => removeExercise(index)} aria-label="Remover exercício" className="p-1 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nome do exercício"
                    value={ex.exercise}
                    onChange={(e) => updateExercise(index, { exercise: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Repetições"
                    value={ex.reps}
                    onChange={(e) => updateExercise(index, { reps: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Séries"
                    value={ex.sets || ''}
                    onChange={(e) => updateExercise(index, { sets: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Nota"
                    value={ex.note || ''}
                    onChange={(e) => updateExercise(index, { note: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Vídeo (URL)"
                    value={ex.video || ''}
                    onChange={(e) => updateExercise(index, { video: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Grupo (bi-set)"
                    value={ex.group || ''}
                    onChange={(e) => updateExercise(index, { group: e.target.value })}
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <select
                    value={ex.type || 'normal'}
                    onChange={(e) => updateExercise(index, { type: e.target.value as Exercise['type'] })}
                    className="border border-gray-300 rounded-lg px-3 py-2 md:col-span-2"
                  >
                    <option value="normal">Normal</option>
                    <option value="warmup">Aquecimento</option>
                    <option value="drop_set">Drop-set</option>
                    <option value="core">Core</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addExercise}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <Plus className="w-4 h-4 mr-1" /> Adicionar exercício
          </button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition font-medium text-lg"
            >
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
