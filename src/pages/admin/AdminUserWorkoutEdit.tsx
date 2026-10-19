import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getUserWorkoutForDay,
  listUserWeekAdmin,
  saveUserWorkoutAdmin,
  deleteUserWorkoutAdmin,
} from '../../utils/adminWorkouts'
import { getUserProfileSummary, UserProfileSummary } from '../../utils/adminUsers'
import { Workout } from '../../types'
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '../../utils/weekdays'
import WorkoutEditor, { WorkoutPayload } from '../../components/admin/WorkoutEditor'

/** Um dia da semana pessoal da aluna. */
export default function AdminUserWorkoutEdit() {
  const { userId, weekday } = useParams<{ userId: string; weekday: string }>()
  const navigate = useNavigate()
  const weekdayNumber = parseInt(weekday || '1')

  const [profile, setProfile] = useState<UserProfileSummary | null>(null)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [filledDays, setFilledDays] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [userId, weekdayNumber])

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
      const [current, week] = await Promise.all([
        getUserWorkoutForDay(userId, weekdayNumber),
        listUserWeekAdmin(userId).catch(() => [] as Workout[]),
      ])
      setWorkout(current)
      setFilledDays(new Set(week.map((w) => w.weekday).filter((d): d is number => d !== null)))
    } catch (error) {
      console.error('Error loading personal workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (payload: WorkoutPayload) => {
    if (!userId) return
    const saved = await saveUserWorkoutAdmin(userId, weekdayNumber, workout?.id ?? null, payload)
    setWorkout({ ...saved, ...payload })
    setFilledDays((prev) => new Set(prev).add(weekdayNumber))
  }

  const handleDelete = async () => {
    if (!workout) return
    await deleteUserWorkoutAdmin(workout.id)
    setWorkout(null)
    setFilledDays((prev) => {
      const next = new Set(prev)
      next.delete(weekdayNumber)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  const name = profile?.username || profile?.email || 'aluna'
  const weekdayLabel = WEEKDAY_NAMES[weekdayNumber - 1] || 'Dia'

  return (
    <WorkoutEditor
      key={`${userId}-${weekdayNumber}`}
      heading={weekdayLabel}
      subtitle={`Semana de ${name} · ${workout ? 'só ela vê este treino' : 'dia de descanso, monte um treino abaixo'}`}
      backTo={`/admin/users/${userId}/workout`}
      initial={{
        title: workout?.title || '',
        videoUrl: workout?.video_url || '',
        exercises: workout?.exercises || [],
      }}
      isNew={!workout}
      showGroup
      nav={WEEKDAY_SHORT.map((label, i) => ({
        label,
        to: `/admin/users/${userId}/workout/day/${i + 1}`,
        active: i + 1 === weekdayNumber,
        filled: filledDays.has(i + 1),
      }))}
      onSave={handleSave}
      onDelete={handleDelete}
      deleteLabel="Transformar em descanso"
      deleteDescription={`O treino de ${weekdayLabel.toLowerCase()} sai da semana de ${name} e o dia vira descanso. Isso não pode ser desfeito.`}
    />
  )
}
