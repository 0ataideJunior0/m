import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProgramBySlug, getWorkoutByProgramAndWeekday } from '../../utils/workouts'
import { updateWorkoutAdmin, createWorkoutAdmin, listWorkoutsForProgramAdmin } from '../../utils/adminWorkouts'
import { Program, Workout } from '../../types'
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '../../utils/weekdays'
import WorkoutEditor, { WorkoutPayload } from '../../components/admin/WorkoutEditor'


export default function AdminWorkoutEdit() {
  const { slug, weekday } = useParams<{ slug: string; weekday: string }>()
  const weekdayNumber = parseInt(weekday || '1')

  const [program, setProgram] = useState<Program | null>(null)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [filledDays, setFilledDays] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [slug, weekdayNumber])

  const load = async () => {
    if (!slug) return
    setLoading(true)
    try {
      const prog = await getProgramBySlug(slug)
      setProgram(prog)
      if (!prog) return

      const [current, all] = await Promise.all([
        getWorkoutByProgramAndWeekday(prog.id, weekdayNumber),
        listWorkoutsForProgramAdmin(prog.id).catch(() => [] as Workout[]),
      ])
      setWorkout(current)
      setFilledDays(new Set(all.map((w) => w.weekday).filter((d): d is number => d !== null)))
    } catch (error) {
      console.error('Error loading workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (payload: WorkoutPayload) => {
    if (!program) return
    if (workout) {
      await updateWorkoutAdmin(workout.id, payload)
      setWorkout({ ...workout, ...payload })
    } else {
      const created = await createWorkoutAdmin(program.id, weekdayNumber, payload)
      setWorkout({ ...(created as Workout), ...payload })
      setFilledDays((prev) => new Set(prev).add(weekdayNumber))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  const weekdayLabel = WEEKDAY_NAMES[weekdayNumber - 1] || 'Dia'

  return (
    <WorkoutEditor
      key={`${slug}-${weekdayNumber}`}
      heading={weekdayLabel}
      subtitle={`${program?.name ?? 'Programa'} · ${workout ? 'editando treino' : 'novo treino'}`}
      backTo={`/admin/programs/${slug}`}
      initial={{
        title: workout?.title || '',
        videoUrl: workout?.video_url || '',
        exercises: workout?.exercises || [],
      }}
      isNew={!workout}
      showGroup
      nav={WEEKDAY_SHORT.map((label, i) => ({
        label,
        to: `/admin/programs/${slug}/day/${i + 1}`,
        active: i + 1 === weekdayNumber,
        filled: filledDays.has(i + 1),
      }))}
      onSave={handleSave}
    />
  )
}
