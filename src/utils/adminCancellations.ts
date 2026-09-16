import { supabase } from '../lib/supabase'
import { CancellationReason, CANCELLATION_REASON_LABELS } from './cancellationReasons'

export interface CancellationFeedbackRow {
  id: string
  email: string
  reason: CancellationReason
  reasonLabel: string
  comment: string | null
  created_at: string
}

export const listCancellationFeedback = async (): Promise<CancellationFeedbackRow[]> => {
  const { data: feedback, error: feedbackError } = await supabase
    .from('subscription_cancellation_feedback')
    .select('id, user_id, reason, comment, created_at')
    .order('created_at', { ascending: false })

  if (feedbackError) throw feedbackError
  const rows = feedback || []
  if (rows.length === 0) return []

  const ids = [...new Set(rows.map((r: any) => r.user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', ids)

  if (profilesError) throw profilesError
  const emails = new Map((profiles || []).map((p: any) => [p.id, p.email]))

  return rows.map((r: any) => ({
    id: r.id,
    email: emails.get(r.user_id) || '—',
    reason: r.reason,
    reasonLabel: CANCELLATION_REASON_LABELS[r.reason as CancellationReason] || r.reason,
    comment: r.comment,
    created_at: r.created_at,
  }))
}
