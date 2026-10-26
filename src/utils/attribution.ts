import type { FunnelUtm } from '../types'

export interface Attribution extends FunnelUtm {
  referrer: string | null
}

const STORAGE_KEY = 'musa_attribution'

const UTM_FIELDS = ['source', 'medium', 'campaign', 'content', 'term'] as const

/**
 * Guarda de onde a pessoa veio (utm_* e referrer) na sessão do navegador, para o
 * checkout aberto mandar junto da compra. Só grava quando a URL traz algum UTM:
 * navegar depois pelo app (sem UTM) não apaga a origem da chegada.
 */
export function captureAttribution(
  search: string = location.search,
  referrer: string = document.referrer,
): void {
  const params = new URLSearchParams(search)
  const utm = Object.fromEntries(UTM_FIELDS.map((field) => [field, params.get(`utm_${field}`) || null]))
  if (!UTM_FIELDS.some((field) => utm[field])) return

  const attribution = { ...utm, referrer: referrer || null }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution))
  } catch {
    // Modo privado ou armazenamento bloqueado: a compra segue sem a origem.
  }
}

export function getAttribution(): Attribution | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Attribution) : null
  } catch {
    return null
  }
}
