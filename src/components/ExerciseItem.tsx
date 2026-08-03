import { CheckCircle, Circle, Play } from 'lucide-react'
import type { Exercise } from '../types'

interface Props {
  exercise: Exercise
  isCompleted: boolean
  onToggle: () => void
  hasVideo: boolean
  onWatchVideo?: () => void
}

export default function ExerciseItem({ exercise, isCompleted, onToggle, hasVideo, onWatchVideo }: Props) {
  const style =
    isCompleted
      ? 'border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800'
      : exercise.type === 'warmup'
      ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800'
      : exercise.type === 'drop_set'
      ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800'
      : 'border-border bg-surface'

  return (
    <div className={`border rounded-lg p-4 transition ${style}`} role="group" aria-label={exercise.exercise}>
      <div className="flex items-start sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium ${isCompleted ? 'text-green-700 dark:text-green-400 line-through' : 'text-text'}`}>
            {exercise.exercise}
          </h3>
          <p className="text-text-muted text-sm">
            {exercise.sets ? `${exercise.sets} séries` : ''}
            {exercise.sets && exercise.reps ? ' • ' : ''}
            {exercise.reps}
          </p>
          {exercise.note && (
            <p
              className={`${
                exercise.type === 'drop_set'
                  ? 'text-red-700 dark:text-red-400'
                  : exercise.type === 'warmup'
                  ? 'text-yellow-700 dark:text-yellow-400'
                  : 'text-text-muted'
              } text-xs mt-1`}
            >
              {exercise.note}
            </p>
          )}
        </div>
        <button
          onClick={onToggle}
          role="checkbox"
          aria-checked={isCompleted}
          aria-label={`Marcar ${exercise.exercise} como concluído`}
          className={`ml-auto inline-flex items-center justify-center w-11 h-11 rounded-full border ${
            isCompleted ? 'border-green-500 bg-green-100 dark:bg-green-900/40' : 'border-border bg-surface'
          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
        >
          {isCompleted ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="w-5 h-5 text-text-muted" />
          )}
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        {hasVideo ? (
          <button
            type="button"
            onClick={onWatchVideo}
            aria-label={`Ver execução de ${exercise.exercise}`}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <Play className="w-4 h-4" />
            Ver execução
          </button>
        ) : (
          <p className="text-xs text-text-muted">Vídeo indisponível</p>
        )}
      </div>
    </div>
  )
}
