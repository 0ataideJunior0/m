import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { addMonths } from './_lib/pixPeriod.js'
import { isGrantableMonths, manualGrantPeriodStart } from './_lib/prepaid.js'

const MAX_NOTE_LENGTH = 500

/**
 * Admin libera acesso por N meses para uma aluna (ex.: pagamento em dinheiro).
 * Funciona como um Pix sem cobrança: grava source = 'manual' em subscriptions
 * e soma ao período pago que ainda estiver valendo.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = (req.headers.authorization as string) || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const { userId, months, note } = req.body ?? {}
  if (typeof userId !== 'string' || !userId) {
    res.status(400).json({ error: 'Aluna inválida' })
    return
  }
  if (!isGrantableMonths(months)) {
    res.status(400).json({ error: 'Quantidade de meses inválida' })
    return
  }
  const noteText = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE_LENGTH) : ''

  const supabaseAdmin = createSupabaseAdmin()
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }
  const caller = userData.user

  // A checagem tem que ser aqui no servidor: esconder o botão na interface não
  // impediria ninguém de chamar o endpoint e se liberar acesso de graça.
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', caller.id)
    .maybeSingle()
  if (!callerProfile?.is_admin) {
    res.status(403).json({ error: 'Apenas administradoras podem liberar acesso' })
    return
  }

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (!target) {
    res.status(404).json({ error: 'Aluna não encontrada' })
    return
  }
  if (target.is_admin) {
    res.status(400).json({ error: 'Administradoras já têm acesso total' })
    return
  }

  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('source, status, next_payment_date')
    .eq('user_id', userId)
    .maybeSingle()

  // Mesma regra do Pix (decisão P0.3): com assinatura viva no cartão, liberar
  // por fora faria a aluna continuar sendo cobrada todo mês.
  if (existing && existing.source === 'preapproval' && existing.status === 'authorized') {
    res.status(409).json({
      error: 'Esta aluna tem assinatura ativa no cartão. Cancele a assinatura antes de liberar acesso manual.',
    })
    return
  }

  const now = new Date()
  const accessUntil = addMonths(manualGrantPeriodStart(existing ?? null, now), months).toISOString()

  // Registro antes do acesso: se o registro falhar, não fica acesso liberado
  // sem rastro de quem liberou.
  const { error: grantError } = await supabaseAdmin.from('manual_grants').insert({
    user_id: userId,
    granted_by: caller.id,
    months,
    access_until: accessUntil,
    note: noteText || null,
  })
  if (grantError) {
    console.error('admin-grant-access: falha ao registrar liberação', { userId, error: grantError })
    res.status(500).json({ error: 'Não foi possível registrar a liberação' })
    return
  }

  const { error: upsertError } = await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      source: 'manual',
      status: 'authorized',
      next_payment_date: accessUntil,
      preapproval_id: null,
      payment_id: null,
      raw: null,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (upsertError) {
    console.error('admin-grant-access: liberação registrada mas acesso não gravado', { userId, error: upsertError })
    res.status(500).json({ error: 'Não foi possível liberar o acesso' })
    return
  }

  res.status(200).json({ accessUntil })
}
