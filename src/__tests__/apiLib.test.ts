import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({ mocked: 'client' })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

const { mercadoPagoConfigMock } = vi.hoisted(() => ({
  mercadoPagoConfigMock: vi.fn(),
}))

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: mercadoPagoConfigMock,
}))

import { createSupabaseAdmin } from '../../api/_lib/supabaseAdmin'
import { createMercadoPagoConfig } from '../../api/_lib/mercadopagoConfig'

describe('createSupabaseAdmin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('cria o client com a URL e a service_role key das env vars', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret')

    createSupabaseAdmin()

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-secret',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  })
})

describe('createMercadoPagoConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('cria a config com o access token da env var', () => {
    vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'TEST-token-123')

    createMercadoPagoConfig()

    expect(mercadoPagoConfigMock).toHaveBeenCalledWith({ accessToken: 'TEST-token-123' })
  })
})
