import { describe, it, expect } from 'vitest'
import { getExerciseKey } from '../utils/exerciseKeys'
import type { Exercise } from '../types'

const ex = (exercise: string, group?: string): Exercise => ({ exercise, reps: '12', group })

describe('getExerciseKey — unicidade posicional', () => {
  it('dá chaves distintas a dois exercícios de mesmo nome em posições diferentes', () => {
    // O caso real: "Prancha" aparece no aquecimento e de novo no core do
    // mesmo treino. Antes da correção ambos viravam 'prancha', então marcar
    // um marcava o outro na tela e o índice user_ex_progress_unique
    // consolidava os dois no servidor.
    const primeira = getExerciseKey(ex('Prancha'), 0)
    const segunda = getExerciseKey(ex('Prancha'), 5)

    expect(primeira).not.toBe(segunda)
  })

  it('dá chaves distintas a exercícios homônimos em grupos de bi-set diferentes', () => {
    const noGrupoA = getExerciseKey(ex('Prancha', 'A'), 2)
    const noGrupoB = getExerciseKey(ex('Prancha', 'B'), 7)

    expect(noGrupoA).not.toBe(noGrupoB)
  })

  it('dá chaves distintas a dois exercícios sem nome em posições diferentes', () => {
    const primeira = getExerciseKey(ex(''), 1)
    const segunda = getExerciseKey(ex(''), 4)

    expect(primeira).not.toBe(segunda)
    expect(primeira).toBeTruthy()
    expect(segunda).toBeTruthy()
  })

  it('não deixa um exercício sem nome colidir com um que tenha nome, na mesma posição', () => {
    expect(getExerciseKey(ex(''), 3)).not.toBe(getExerciseKey(ex('Agachamento'), 3))
  })
})

describe('getExerciseKey — estabilidade', () => {
  it('devolve a mesma chave para o mesmo exercício na mesma posição', () => {
    const primeira = getExerciseKey(ex('Agachamento Sumô'), 3)
    const segunda = getExerciseKey(ex('Agachamento Sumô'), 3)

    expect(primeira).toBe(segunda)
  })

  it('devolve a mesma chave para objetos equivalentes mas não idênticos', () => {
    // Garante que a chave depende do conteúdo, não da referência —
    // o array de exercícios é recriado a cada render.
    expect(getExerciseKey({ exercise: 'Remada', reps: '10' }, 2))
      .toBe(getExerciseKey({ exercise: 'Remada', reps: '10' }, 2))
  })
})

describe('getExerciseKey — normalização do slug', () => {
  it('remove acentos e caixa alta de forma determinística', () => {
    expect(getExerciseKey(ex('Agachamento Sumô'), 0)).toBe('0-agachamento-sumo')
  })

  it('mantém o grupo legível no slug', () => {
    expect(getExerciseKey(ex('Búlgaro', 'A'), 4)).toBe('4-gA-bulgaro')
  })

  it('não deixa hífen sobrando nas pontas', () => {
    const key = getExerciseKey(ex('  Elevação Lateral!  '), 1)

    expect(key).toBe('1-elevacao-lateral')
    expect(key.endsWith('-')).toBe(false)
  })

  it('produz chave utilizável quando o nome só tem símbolos', () => {
    const key = getExerciseKey(ex('!!!'), 2)

    expect(key).toBe('2-exercicio')
    expect(key).toBeTruthy()
  })
})

describe('getExerciseKey — compatibilidade com o formato antigo', () => {
  it('nunca gera uma chave igual à do formato antigo', () => {
    // O formato antigo era o slug puro ('agachamento'). O novo sempre
    // começa com dígito + hífen, então linhas antigas em
    // user_exercise_progress ficam inertes em vez de apontar para o
    // exercício errado. É isso que torna o DELETE da Tarefa 2.4
    // higiene, e não correção.
    const chaveNova = getExerciseKey(ex('Agachamento'), 0)

    expect(chaveNova).not.toBe('agachamento')
    expect(chaveNova).toMatch(/^\d+-/)
  })
})
