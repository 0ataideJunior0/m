import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminFunnel from '../pages/admin/AdminFunnel'
import type { PurchaseIntent } from '../types'

const { loadFunnelDataMock, resendAccessMock } = vi.hoisted(() => ({
  loadFunnelDataMock: vi.fn(),
  resendAccessMock: vi.fn(),
}))

vi.mock('../utils/funnel', async () => {
  const actual = await vi.importActual<typeof import('../utils/funnel')>('../utils/funnel')
  return { ...actual, loadFunnelData: loadFunnelDataMock }
})
vi.mock('../utils/checkout', () => ({ resendAccess: resendAccessMock }))

const intent = (over: Partial<PurchaseIntent> = {}): PurchaseIntent => ({
  id: 'i1',
  email: 'ana@example.com',
  plan_id: 'mensal',
  method: 'pix',
  months: 1,
  amount: 49.9,
  utm_source: 'instagram',
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  referrer: null,
  status: 'paid',
  last_payment_status: 'approved',
  payment_id: 'p1',
  user_id: 'u1',
  created_at: '2026-10-20T12:00:00.000Z',
  paid_at: '2026-10-20T12:05:00.000Z',
  access_email_sent_at: '2026-10-20T12:06:00.000Z',
  link_opened_at: null,
  password_set_at: null,
  ...over,
})

const data = (intents: PurchaseIntent[] = [intent()]) => ({
  intents,
  onboardedUserIds: new Set<string>(),
  firstWorkoutUserIds: new Set<string>(),
})

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/admin/funnel']}>
      <Routes>
        <Route path="/admin/funnel" element={<AdminFunnel />} />
        <Route path="/admin" element={<div>Painel</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe('AdminFunnel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'))
    loadFunnelDataMock.mockReset()
    resendAccessMock.mockReset()
    loadFunnelDataMock.mockResolvedValue(data())
  })
  afterEach(() => vi.useRealTimers())

  it('carrega 30 dias por padrão e mostra etapas, origem e a lista de quem não criou a senha', async () => {
    renderScreen()
    expect(await screen.findByText('Checkout iniciado')).not.toBeNull()
    expect(loadFunnelDataMock).toHaveBeenCalledTimes(1)
    const since = loadFunnelDataMock.mock.calls[0][0] as Date
    expect(since.toISOString()).toBe('2026-09-26T12:00:00.000Z')

    for (const label of ['Pagou', 'Abriu o link', 'Criou a senha', 'Fez o onboarding', 'Primeiro treino']) {
      expect(screen.getByText(label)).not.toBeNull()
    }
    expect(screen.getByText('instagram')).not.toBeNull()
    expect(screen.getByText('Pagaram e não criaram a senha')).not.toBeNull()
    expect(screen.getByText('ana@example.com')).not.toBeNull()
    expect(screen.getByRole('button', { name: '30 dias' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('mostra a porcentagem relativa à etapa anterior e "—" quando a anterior é zero', async () => {
    loadFunnelDataMock.mockResolvedValue(
      data([
        intent({ email: 'a@x.com', link_opened_at: '2026-10-20T13:00:00.000Z' }),
        intent({ id: 'i2', email: 'b@x.com', status: 'pending', paid_at: null }),
      ]),
    )
    renderScreen()
    const checkout = (await screen.findByText('Checkout iniciado')).closest('li') as HTMLElement
    expect(within(checkout).getByText('100%')).not.toBeNull()
    const paid = screen.getByText('Pagou').closest('li') as HTMLElement
    expect(within(paid).getByText('50%')).not.toBeNull()
    const password = screen.getByText('Criou a senha').closest('li') as HTMLElement
    expect(within(password).getByText('0%')).not.toBeNull()
    // onboarding vem depois de 0 pessoas na etapa anterior
    const onboarding = screen.getByText('Fez o onboarding').closest('li') as HTMLElement
    expect(within(onboarding).getByText('—')).not.toBeNull()
  })

  it('mostra quantas pessoas que pagaram já tinham conta, sem listá-las para reenvio', async () => {
    loadFunnelDataMock.mockResolvedValue(
      data([
        intent(),
        intent({ id: 'i2', email: 'renova@x.com', user_id: 'u2', access_email_sent_at: null }),
      ]),
    )
    renderScreen()
    const paid = (await screen.findByText('Pagou')).closest('li') as HTMLElement
    expect(within(paid).getByText('Já tinham conta: 1')).not.toBeNull()
    expect(screen.getByText('ana@example.com')).not.toBeNull()
    expect(screen.queryByText('renova@x.com')).toBeNull()
    expect(screen.getAllByRole('button', { name: /Reenviar acesso/ })).toHaveLength(1)
  })

  it('troca o período e chama loadFunnelData com a data nova', async () => {
    renderScreen()
    await screen.findByText('Checkout iniciado')

    fireEvent.click(screen.getByRole('button', { name: '7 dias' }))
    await waitFor(() => expect(loadFunnelDataMock).toHaveBeenCalledTimes(2))
    expect((loadFunnelDataMock.mock.calls[1][0] as Date).toISOString()).toBe('2026-10-19T12:00:00.000Z')
    expect(screen.getByRole('button', { name: '7 dias' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: '90 dias' }))
    await waitFor(() => expect(loadFunnelDataMock).toHaveBeenCalledTimes(3))
    expect((loadFunnelDataMock.mock.calls[2][0] as Date).toISOString()).toBe('2026-07-28T12:00:00.000Z')
  })

  it('"Reenviar acesso" chama resendAccess com o e-mail e avisa o resultado', async () => {
    resendAccessMock.mockResolvedValue({ ok: true })
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: /Reenviar acesso/ }))
    await waitFor(() => expect(resendAccessMock).toHaveBeenCalledWith('ana@example.com'))
    expect(await screen.findByText('Acesso reenviado para ana@example.com.')).not.toBeNull()
  })

  it('avisa quando o reenvio falha', async () => {
    resendAccessMock.mockResolvedValue({ ok: false, error: 'Muitas tentativas' })
    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: /Reenviar acesso/ }))
    expect(await screen.findByText('Muitas tentativas')).not.toBeNull()
  })

  it('mostra o erro com "Tentar de novo", que recarrega', async () => {
    loadFunnelDataMock.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderScreen()
    expect(await screen.findByText('Não foi possível carregar o funil.')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Checkout iniciado')).not.toBeNull()
    expect(loadFunnelDataMock).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})
