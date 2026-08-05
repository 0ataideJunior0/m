import { describe, it, expect } from 'vitest'
import { mergeServerLocal, loadLocalProgress, saveLocalProgress, clearLocalProgress } from '../utils/exerciseProgress'

// A cobertura de getExerciseKey saiu daqui e virou src/__tests__/exerciseKeys.test.ts,
// que testa normalização, unicidade posicional e estabilidade em profundidade.

describe('merge server/local', () => {
  it('server tem prioridade sobre local', () => {
    const local = { 'ex-1': { completed: false, ts: 1 } }
    const server = { 'ex-1': true }
    const merged = mergeServerLocal(server, local)
    expect(merged['ex-1'].completed).toBe(true)
  })
  it('mantém local quando não há server', () => {
    const local = { 'ex-1': { completed: true, ts: 1 } }
    const server = {}
    const merged = mergeServerLocal(server, local)
    expect(merged['ex-1'].completed).toBe(true)
  })
})

describe('clearLocalProgress', () => {
  it('remove o progresso salvo daquela usuária e treino', () => {
    saveLocalProgress('u1', 'w1', { 'ex-1': { completed: true, ts: 1 } })
    expect(loadLocalProgress('u1', 'w1')).toEqual({ 'ex-1': { completed: true, ts: 1 } })

    clearLocalProgress('u1', 'w1')

    expect(loadLocalProgress('u1', 'w1')).toEqual({})
  })
})

describe('cache local após a mudança de formato de chave', () => {
  it('ignora o cache gravado no formato antigo de chave', () => {
    // Cache de uma versão anterior do app, com chaves sem índice
    // posicional. Lê-lo marcaria os exercícios errados na tela, então o
    // prefixo do localStorage foi versionado para que ele seja ignorado.
    localStorage.setItem(
      'exerciseProgress:u1:w1',
      JSON.stringify({ prancha: { completed: true, ts: 1 } }),
    )

    expect(loadLocalProgress('u1', 'w1')).toEqual({})
  })

  it('lê normalmente o cache gravado no formato novo', () => {
    saveLocalProgress('u2', 'w2', { '0-prancha': { completed: true, ts: 1 } })

    expect(loadLocalProgress('u2', 'w2')).toEqual({ '0-prancha': { completed: true, ts: 1 } })
  })
})

