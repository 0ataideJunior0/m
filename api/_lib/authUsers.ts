import type { User } from '@supabase/supabase-js'
import type { createSupabaseAdmin } from './supabaseAdmin.js'

type AdminClient = Pick<ReturnType<typeof createSupabaseAdmin>, 'auth'>

const PER_PAGE = 1000

/**
 * Procura a usuária pelo e-mail de AUTENTICAÇÃO (auth.users), nunca por
 * profiles.email, que não é confiável. A API de admin não filtra por e-mail,
 * então percorre as páginas; a base é pequena. Devolve null se não existir.
 */
export async function findAuthUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  const wanted = email.trim().toLowerCase()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) throw error
    const match = (data.users as User[]).find((u) => (u.email ?? '').toLowerCase() === wanted)
    if (match) return match.id
    if (data.users.length < PER_PAGE) return null
  }
}
