type ProgressMap = Record<string, { completed: boolean; ts: number }>

const LS_PREFIX = 'exerciseProgress:'

export function loadLocalProgress(userId: string, dayNumber: number): ProgressMap {
  const key = `${LS_PREFIX}${userId}:${dayNumber}`
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveLocalProgress(userId: string, dayNumber: number, data: ProgressMap) {
  const key = `${LS_PREFIX}${userId}:${dayNumber}`
  try {
    localStorage.setItem(key, JSON.stringify(data))
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

