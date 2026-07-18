import { supabase } from '../lib/supabase'
import { Subscription } from '../types'

export const getHasActiveSubscription = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single()

  if (error || !data) return false
  return data.status === 'authorized'
}

export const getMySubscription = async (userId: string): Promise<Subscription | null> => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as Subscription
}

export const createSubscription = async (): Promise<{ initPoint: string | null; error: string | null }> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { initPoint: null, error: 'Sessão inválida' }

  try {
    const response = await fetch('/api/create-subscription', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()
    if (!response.ok) return { initPoint: null, error: body?.error || 'Erro ao criar assinatura' }
    return { initPoint: body.init_point, error: null }
  } catch {
    return { initPoint: null, error: 'Erro ao criar assinatura' }
  }
}

export const cancelSubscription = async (): Promise<{ ok: boolean; error: string | null }> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { ok: false, error: 'Sessão inválida' }

  try {
    const response = await fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()
    if (!response.ok) return { ok: false, error: body?.error || 'Erro ao cancelar assinatura' }
    return { ok: true, error: null }
  } catch {
    return { ok: false, error: 'Erro ao cancelar assinatura' }
  }
}
