import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ExerciseItem from '../components/ExerciseItem'
import type { Exercise } from '../types'

const exercise: Exercise = { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }

describe('ExerciseItem', () => {
  it('renders exercise info and the completion check', () => {
    render(<ExerciseItem exercise={exercise} isCompleted={false} onToggle={() => {}} hasVideo={false} />)

    expect(screen.getByText('Agachamento')).toBeInTheDocument()
    expect(screen.getByText(/3 séries/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /marcar agachamento como concluído/i })).toBeInTheDocument()
  })

  it('calls onToggle when the completion check is clicked', () => {
    const onToggle = vi.fn()
    render(<ExerciseItem exercise={exercise} isCompleted={false} onToggle={onToggle} hasVideo={false} />)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows "Vídeo indisponível" and no video button when hasVideo is false', () => {
    render(<ExerciseItem exercise={exercise} isCompleted={false} onToggle={() => {}} hasVideo={false} />)

    expect(screen.getByText('Vídeo indisponível')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver execução/i })).not.toBeInTheDocument()
  })

  it('shows a "Ver execução" button when hasVideo is true and calls onWatchVideo when clicked', () => {
    const onWatchVideo = vi.fn()
    render(
      <ExerciseItem
        exercise={exercise}
        isCompleted={false}
        onToggle={() => {}}
        hasVideo={true}
        onWatchVideo={onWatchVideo}
      />
    )

    const button = screen.getByRole('button', { name: /ver execução/i })
    fireEvent.click(button)
    expect(onWatchVideo).toHaveBeenCalledTimes(1)
  })
})
