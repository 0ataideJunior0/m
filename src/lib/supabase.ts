import { createClient } from '@supabase/supabase-js'
import { getCSRFToken, getOriginAllowed } from '../utils/security'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'X-CSRF-Token': getCSRFToken(),
      'X-Origin': getOriginAllowed() ? location.origin : 'unknown',
    },
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
