import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'musa_auth_enc'
const SALT = 'musa_salt_v1'

async function importKey(secret: string) {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptSession(refreshToken: string, payload: Record<string, any>) {
  const key = await importKey(refreshToken)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(payload))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const buf = new Uint8Array(cipher)
  const out = { iv: Array.from(iv), c: Array.from(buf) }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(out)) } catch {}
}

export async function decryptSession(refreshToken: string): Promise<Record<string, any> | null> {
  let raw = null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch {}
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const key = await importKey(refreshToken)
    const iv = new Uint8Array(parsed.iv)
    const c = new Uint8Array(parsed.c)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, c)
    const text = new TextDecoder().decode(plain)
    return JSON.parse(text)
  } catch { return null }
}

export async function tryRestoreSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session
  // fallback using encrypted cache with last known refresh token persisted by supabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // attempt to read current stored session via supabase internal storage
  const { data: s } = await supabase.auth.getSession()
  const rt = s.session?.refresh_token || ''
  if (!rt) return null
  const cached = await decryptSession(rt)
  if (!cached) return null
  const access_token = cached.access_token
  const refresh_token = cached.refresh_token || rt
  if (!access_token || !refresh_token) return null
  const { data: setData, error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) return null
  return setData.session || null
}

export async function persistCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  }
  await encryptSession(session.refresh_token, payload)
}

export function clearPersistedSession() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

