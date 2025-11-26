import { supabase } from '../lib/supabase'

export type PlanType = 'mass_gain' | 'fat_loss'

export const getPlanMeta = async (type: PlanType) => {
  const { data, error } = await supabase
    .from('pdf_plans')
    .select('*')
    .eq('type', type)
    .single()
  if (error) throw error
  return data as {
    type: PlanType
    title: string
    description: string | null
    storage_bucket: string
    storage_key: string
  }
}

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const resolveActualKey = async (bucket: string, expectedKey: string, type: PlanType) => {
  const { data, error } = await supabase
    .from('storage.objects')
    .select('name')
    .eq('bucket_id', bucket)
    .ilike('name', '%.pdf')
  if (error || !data || data.length === 0) return expectedKey
  const expectedNorm = normalize(expectedKey)
  const exact = data.find(d => normalize(d.name) === expectedNorm)
  if (exact) return exact.name
  const hints = type === 'mass_gain'
    ? ['mass', 'massa', 'hipertrofia']
    : ['fat', 'gordura', 'perda', 'definicao']
  const cand = data.find(d => {
    const n = normalize(d.name)
    return hints.some(h => n.includes(h))
  })
  return cand?.name || data[0].name
}

export const getSignedPlanUrl = async (type: PlanType, expiresInSeconds: number = 300) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticada')
  const meta = await getPlanMeta(type)
  const { data, error } = await supabase.storage
    .from(meta.storage_bucket)
    .createSignedUrl(meta.storage_key, expiresInSeconds)
  if (!error) return { url: data.signedUrl, meta }
  const key = await resolveActualKey(meta.storage_bucket, meta.storage_key, type)
  const retry = await supabase.storage
    .from(meta.storage_bucket)
    .createSignedUrl(key, expiresInSeconds)
  if (retry.error) throw retry.error
  if (key !== meta.storage_key) {
    await supabase
      .from('pdf_plans')
      .update({ storage_key: key })
      .eq('type', type)
  }
  return { url: retry.data.signedUrl, meta: { ...meta, storage_key: key } }
}
