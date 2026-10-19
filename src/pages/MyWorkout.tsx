import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Moon } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getMyWeek } from '../utils/workouts'
import { Workout } from '../types'
import { WEEKDAYS, WEEKDAY_NAMES, todayWeekday } from '../utils/weekdays'
import { cn } from '../lib/utils'

/** Semana personalizada da aluna: os 7 dias, com o de hoje em destaque. */
export default function MyWorkout() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()

  const [week, setWeek] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    load()
  }, [isAuthenticated])

  const load = async () => {
    if (!user) return
    try {
      setWeek(await getMyWeek(user.id))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-border-card rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-border-card rounded w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-border-card rounded w-24 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (week.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">Nenhum treino pessoal por aqui</h2>
          <p className="text-text-muted mb-4">Sua treinadora ainda não montou uma semana personalizada pra você.</p>
          <button onClick={() => navigate('/home')} className="text-accent-text hover:opacity-80">
            Voltar à Home
          </button>
        </div>
      </div>
    )
  }

  const today = todayWeekday()
  const byDay = new Map(week.map((w) => [w.weekday, w]))

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/home')}
            aria-label="Voltar"
            className="mr-4 p-2 rounded-lg hover:bg-surface-hover transition"
          >
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-strong">Minha semana</h1>
            <p className="text-text-muted">Montada pela sua treinadora só pra você</p>
          </div>
        </div>

        <ol className="space-y-3">
          {WEEKDAYS.map((day) => {
            const workout = byDay.get(day)
            const isToday = day === today
            const count = workout?.exercises?.length || 0
            const label = (
              <>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-text-strong">{WEEKDAY_NAMES[day - 1]}</span>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full brand-gradient text-xs font-extrabold">Hoje</span>
                    )}
                  </span>
                  {workout ? (
                    <span className="block text-sm text-text-muted truncate">
                      {workout.title} · {count} {count === 1 ? 'exercício' : 'exercícios'}
                    </span>
                  ) : (
                    <span className="flex items-center text-sm text-text-muted">
                      <Moon aria-hidden="true" className="w-4 h-4 mr-1" /> Descanso
                    </span>
                  )}
                </span>
                {workout && <ChevronRight aria-hidden="true" className="w-5 h-5 text-text-muted shrink-0" />}
              </>
            )
            const cardClass = cn(
              'flex items-center gap-3 w-full text-left bg-surface border rounded-3xl p-5',
              isToday ? 'border-accent shadow-lg' : 'border-border-card shadow-sm',
              !workout && 'opacity-70'
            )
            return (
              <li key={day}>
                {workout ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/meu-treino/dia/${day}`)}
                    className={cn(cardClass, 'hover:shadow-lg transition focus:outline-none focus:ring-2 focus:ring-focus-ring')}
                  >
                    {label}
                  </button>
                ) : (
                  <div className={cardClass}>{label}</div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
