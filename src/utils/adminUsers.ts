import { supabase } from '../lib/supabase'

export interface AdminUserSummary {
  id: string
  email: string
  username: string | null
  created_at: string
  completedDays: number
}

export const listNonAdminUsers = async (): Promise<AdminUserSummary[]> => {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, username, created_at')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })

  if (profilesError) throw profilesError
  const rows = profiles || []
  if (rows.length === 0) return []

  const ids = rows.map((p: any) => p.id)
  const { data: progress, error: progressError } = await supabase
    .from('user_progress')
    .select('user_id')
    .in('user_id', ids)
    .eq('completed', true)

  if (progressError) throw progressError

  const counts = new Map<string, number>()
  for (const row of progress || []) {
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1)
  }

  return rows.map((p: any) => ({
    id: p.id,
    email: p.email,
    username: p.username,
    created_at: p.created_at,
    completedDays: counts.get(p.id) || 0,
  }))
}
