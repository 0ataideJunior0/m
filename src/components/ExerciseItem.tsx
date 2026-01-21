import { CheckCircle, Circle } from 'lucide-react'
import type { Exercise } from '../types'

interface Props {
  exercise: Exercise
  isCompleted: boolean
  onToggle: () => void
}

export default function ExerciseItem({ exercise, isCompleted, onToggle }: Props) {
  const style =
    isCompleted
      ? 'border-green-300 bg-green-50'
      : exercise.type === 'warmup'
      ? 'border-yellow-300 bg-yellow-50'
      : exercise.type === 'drop_set'
      ? 'border-red-300 bg-red-50'
      : 'border-gray-200 bg-white'

  return (
    <div
      className={`border rounded-lg p-4 transition ${style}`}
      role="group"
      aria-label={exercise.exercise}
    >
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={isCompleted}
        aria-label={`Marcar ${exercise.exercise} como concluído`}
        className={`mr-3 inline-flex items-center justify-center w-8 h-8 rounded-full border ${
          isCompleted ? 'border-green-500 bg-green-100' : 'border-gray-300 bg-white'
        } focus:outline-none focus:ring-2 focus:ring-purple-500`}
      >
        {isCompleted ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Circle className="w-5 h-5 text-gray-400" />}
      </button>
      <div className="inline-block align-middle max-w-[85%]">
        <h3 className={`font-medium ${isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>{exercise.exercise}</h3>
        <p className="text-gray-600 text-sm">
          {exercise.sets ? `${exercise.sets} séries` : ''}
          {exercise.sets && exercise.reps ? ' • ' : ''}
          {exercise.reps}
        </p>
        {exercise.note && (
          <p className={`${exercise.type === 'drop_set' ? 'text-red-700' : exercise.type === 'warmup' ? 'text-yellow-700' : 'text-gray-600'} text-xs mt-1`}>{exercise.note}</p>
        )}
      </div>
    </div>
  )
}

