import type { createSupabaseAdmin } from './supabaseAdmin.js'

type AdminClient = Pick<ReturnType<typeof createSupabaseAdmin>, 'auth'>

/**
 * Manda o e-mail de acesso (template "Magic Link" do Supabase) para quem pagou
 * no checkout aberto. O cliente do servidor usa o fluxo implícito padrão (sem
 * PKCE), então o link funciona mesmo aberto num navegador diferente daquele
 * onde a compra foi feita (ex.: pagou no Instagram, abriu no Gmail).
 * `shouldCreateUser: false`: a conta já existe nessa hora; o link nunca cria.
 */
export async function sendAccessEmail(admin: AdminClient, email: string, origin: string): Promise<void> {
  const { error } = await admin.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/primeiro-acesso` },
  })
  if (error) throw error
}
