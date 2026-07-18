import { createClient } from '@supabase/supabase-js'

export const createSupabaseAdmin = () => {
  const url = process.env.VITE_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
