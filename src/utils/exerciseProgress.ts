type ProgressMap = Record<string, { completed: boolean; ts: number }>

// Versionado em v2 quando as chaves de exercício passaram a incluir o índice
// posicional (ver getExerciseKey). O cache gravado no formato antigo marcaria
// os exercícios errados na tela; bumpar o prefixo faz o navegador simplesmente
// ignorá-lo, sem migração e sem lixo ativo.
const LS_PREFIX = 'exerciseProgress:v2:'

export function loadLocalProgress(userId: string, workoutId: string): ProgressMap {
  const key = `${LS_PREFIX}${userId}:${workoutId}`
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveLocalProgress(userId: string, workoutId: string, data: ProgressMap) {
  const key = `${LS_PREFIX}${userId}:${workoutId}`
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {}
}

export function clearLocalProgress(userId: string, workoutId: string) {
  const key = `${LS_PREFIX}${userId}:${workoutId}`
  try {
    localStorage.removeItem(key)
  } catch {}
}

export function mergeServerLocal(server: Record<string, boolean>, local: ProgressMap): ProgressMap {
  const out: ProgressMap = { ...local }
  for (const k of Object.keys(server)) {
    const completed = !!server[k]
    const prev = out[k]
    if (!prev || completed !== prev.completed) {
      out[k] = { completed, ts: Date.now() }
    }
  }
  return out
}

