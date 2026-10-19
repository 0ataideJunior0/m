import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getUserWorkout, saveUserWorkoutAdmin, deleteUserWorkoutAdmin } from '../../utils/adminWorkouts'
import { getUserProfileSummary, UserProfileSummary } from '../../utils/adminUsers'
import { Workout } from '../../types'
import WorkoutEditor, { WorkoutPayload } from '../../components/admin/WorkoutEditor'

export default function AdminUserWorkoutEdit() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<UserProfileSummary | null>(null)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [userId])

  const load = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const summary = await getUserProfileSummary(userId)
      if (!summary) {
        navigate('/admin/users')
        return
      }
      setProfile(summary)
      setWorkout(await getUserWorkout(userId))
    } catch (error) {
      console.error('Error loading personal workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (payload: WorkoutPayload) => {
    if (!userId) return
    const saved = await saveUserWorkoutAdmin(userId, workout?.id ?? null, payload)
    setWorkout({ ...saved, ...payload })
  }

  const handleDelete = async () => {
    if (!workout) return
    await deleteUserWorkoutAdmin(workout.id)
    setWorkout(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  const name = profile?.username || profile?.email || 'aluna'

  return (
    <WorkoutEditor
      key={userId}
      heading={`Treino pessoal de ${name}`}
      subtitle={workout ? 'Só ela vê este treino, na tela inicial do app.' : 'Ela ainda não tem treino pessoal. Monte um abaixo.'}
      backTo="/admin/users"
      initial={{
        title: workout?.title || '',
        videoUrl: workout?.video_url || '',
        exercises: workout?.exercises || [],
      }}
      isNew={!workout}
      showGroup={false}
      onSave={handleSave}
      onDelete={handleDelete}
      deleteLabel="Remover treino pessoal"
      deleteDescription={`${name} deixa de ver este treino no app. Isso não pode ser desfeito.`}
    />
  )
}
