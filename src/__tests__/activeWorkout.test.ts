import { describe, it, expect, beforeEach } from 'vitest'
import {
  ACTIVE_WORKOUT_TTL_MS,
  getActiveWorkout,
  startActiveWorkout,
  clearActiveWorkout,
  activeWorkoutKey,
} from '../utils/activeWorkout'

const info = { workoutId: 'w1', title: 'Treino A', path: '/program/avancado/day/1' }

beforeEach(() => {
  localStorage.clear()
})

describe('activeWorkout', () => {
  it('sem treino iniciado, não há treino em andamento', () => {
    expect(getActiveWorkout('u1')).toBeNull()
  })

  it('iniciar grava o treino em andamento com o horário de início', () => {
    const started = startActiveWorkout('u1', info, 1000)

    expect(started).toEqual({ ...info, startedAt: 1000 })
    expect(getActiveWorkout('u1', 2000)).toEqual({ ...info, startedAt: 1000 })
  })

  it('limpar encerra o treino em andamento', () => {
    startActiveWorkout('u1', info)
    clearActiveWorkout('u1')

    expect(getActiveWorkout('u1')).toBeNull()
  })

  it('cada usuária tem o seu treino em andamento', () => {
    startActiveWorkout('u1', info)

    expect(getActiveWorkout('u2')).toBeNull()
  })

  it('expira depois do prazo, pra um treino esquecido não travar a conta pra sempre', () => {
    startActiveWorkout('u1', info, 0)

    expect(getActiveWorkout('u1', ACTIVE_WORKOUT_TTL_MS - 1)).not.toBeNull()
    expect(getActiveWorkout('u1', ACTIVE_WORKOUT_TTL_MS + 1)).toBeNull()
    expect(localStorage.getItem(activeWorkoutKey('u1'))).toBeNull()
  })

  it('ignora conteúdo corrompido em vez de quebrar', () => {
    localStorage.setItem(activeWorkoutKey('u1'), '{nao é json')
    expect(getActiveWorkout('u1')).toBeNull()

    localStorage.setItem(activeWorkoutKey('u1'), JSON.stringify({ workoutId: 1 }))
    expect(getActiveWorkout('u1')).toBeNull()
  })
})
