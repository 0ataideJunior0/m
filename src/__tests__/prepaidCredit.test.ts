import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creditPrepaidPeriod } from '../../api/_lib/prepaidCredit'

function fakeAdmin(
  opts: {
    ledgerError?: unknown
    existing?: unknown
    selectError?: unknown
    upsertError?: unknown
    upsertThrows?: Error
    updateError?: unknown
    ledgerDeleteError?: unknown
  } = {},
) {
  const ledgerInsert = vi.fn().mockResolvedValue({ error: opts.ledgerError ?? null })
  const ledgerDeleteEq = vi.fn().mockResolvedValue({ error: opts.ledgerDeleteError ?? null })
  const ledgerDelete = vi.fn(() => ({ eq: ledgerDeleteEq }))
  const upsert = opts.upsertThrows
    ? vi.fn().mockRejectedValue(opts.upsertThrows)
    : vi.fn().mockResolvedValue({ error: opts.upsertError ?? null })
  const updateEq = vi.fn().mockResolvedValue({ error: opts.updateError ?? null })
  const update = vi.fn(() => ({ eq: updateEq }))
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.existing ?? null, error: opts.selectError ?? null })
  const select = vi.fn(() => ({ eq: () => ({ maybeSingle }) }))
  const from = vi.fn((table: string) =>
    table === 'pix_payments' ? { insert: ledgerInsert, delete: ledgerDelete } : { select, upsert, update },
  )
  return { admin: { from } as any, ledgerInsert, ledgerDelete, ledgerDeleteEq, upsert, update }
}

const base = { userId: 'user-1', months: 3, paymentId: '12345', amount: 129.9, raw: { id: 12345 } }

describe('creditPrepaidPeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('grava no livro-razão e credita a partir de agora quando não há acesso vigente', async () => {
    const { admin, ledgerInsert, upsert } = fakeAdmin()

    const result = await creditPrepaidPeriod(admin, { ...base, source: 'pix' })

    expect(result).toBe('credited')
    expect(ledgerInsert).toHaveBeenCalledWith({
      payment_id: '12345',
      user_id: 'user-1',
      months: 3,
      amount: 129.9,
      status: 'approved',
      raw: { id: 12345 },
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        source: 'pix',
        payment_id: '12345',
        preapproval_id: null,
        status: 'authorized',
        next_payment_date: '2026-11-19T12:00:00.000Z',
      }),
      { onConflict: 'user_id' },
    )
  })

  it("grava source 'card' no cartão avulso", async () => {
    const { admin, upsert } = fakeAdmin()

    await creditPrepaidPeriod(admin, { ...base, source: 'card' })

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ source: 'card' }), { onConflict: 'user_id' })
  })

  it('soma sobre o acesso pré-pago que ainda está valendo', async () => {
    const { admin, upsert } = fakeAdmin({
      existing: { source: 'card', status: 'authorized', next_payment_date: '2026-09-19T12:00:00.000Z' },
    })

    await creditPrepaidPeriod(admin, { ...base, source: 'pix' })

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ next_payment_date: '2026-12-19T12:00:00.000Z' }),
      { onConflict: 'user_id' },
    )
  })

  it("reentrega (UNIQUE no livro-razão) devolve 'duplicate' e não credita", async () => {
    const { admin, upsert, update } = fakeAdmin({ ledgerError: { code: '23505' } })

    const result = await creditPrepaidPeriod(admin, { ...base, source: 'pix' })

    expect(result).toBe('duplicate')
    expect(upsert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('outro erro no livro-razão é lançado', async () => {
    const { admin } = fakeAdmin({ ledgerError: { code: '42P01', message: 'boom' } })

    await expect(creditPrepaidPeriod(admin, { ...base, source: 'pix' })).rejects.toMatchObject({ code: '42P01' })
  })

  // Livro-razão gravado sem a assinatura = pagou e ficou sem acesso para
  // sempre (toda reentrega daria 'duplicate'). Desfaz o livro-razão e lança,
  // para o MP reenviar e creditar de novo.
  describe('falha depois do livro-razão', () => {
    it('upsert devolve erro: apaga a linha do livro-razão e lança', async () => {
      const { admin, ledgerDelete, ledgerDeleteEq } = fakeAdmin({ upsertError: { code: 'XX000', message: 'boom' } })

      await expect(creditPrepaidPeriod(admin, { ...base, source: 'pix' })).rejects.toMatchObject({ code: 'XX000' })
      expect(ledgerDelete).toHaveBeenCalled()
      expect(ledgerDeleteEq).toHaveBeenCalledWith('payment_id', '12345')
    })

    it('upsert lança: apaga a linha do livro-razão e relança', async () => {
      const { admin, ledgerDeleteEq } = fakeAdmin({ upsertThrows: new Error('network') })

      await expect(creditPrepaidPeriod(admin, { ...base, source: 'pix' })).rejects.toThrow('network')
      expect(ledgerDeleteEq).toHaveBeenCalledWith('payment_id', '12345')
    })

    it('select em subscriptions devolve erro: apaga a linha do livro-razão e lança', async () => {
      const { admin, ledgerDeleteEq, upsert } = fakeAdmin({ selectError: { code: '57014', message: 'timeout' } })

      await expect(creditPrepaidPeriod(admin, { ...base, source: 'pix' })).rejects.toMatchObject({ code: '57014' })
      expect(upsert).not.toHaveBeenCalled()
      expect(ledgerDeleteEq).toHaveBeenCalledWith('payment_id', '12345')
    })

    it('update do caso anômalo devolve erro: apaga a linha do livro-razão e lança', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { admin, ledgerDeleteEq } = fakeAdmin({
        existing: { source: 'preapproval', status: 'authorized', preapproval_id: 'pa-1', next_payment_date: null },
        updateError: { code: 'XX001', message: 'boom' },
      })

      await expect(creditPrepaidPeriod(admin, { ...base, source: 'pix' })).rejects.toMatchObject({ code: 'XX001' })
      errorSpy.mockRestore()
      expect(ledgerDeleteEq).toHaveBeenCalledWith('payment_id', '12345')
    })

    it('se nem o delete do livro-razão funcionar, loga alto e relança o erro original', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { admin } = fakeAdmin({
        upsertError: { code: 'XX000', message: 'boom' },
        ledgerDeleteError: { message: 'delete failed' },
      })

      await expect(creditPrepaidPeriod(admin, { ...base, source: 'pix' })).rejects.toMatchObject({ code: 'XX000' })
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('livro-razão'),
        expect.objectContaining({ paymentId: '12345', userId: 'user-1' }),
      )
      errorSpy.mockRestore()
    })
  })

  it('com assinatura recorrente ativa, credita a data mas preserva a linha do cartão', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, upsert, update } = fakeAdmin({
      existing: { source: 'preapproval', status: 'authorized', preapproval_id: 'pa-1', next_payment_date: null },
    })

    const result = await creditPrepaidPeriod(admin, { ...base, source: 'card' })
    errorSpy.mockRestore()

    expect(result).toBe('credited')
    expect(upsert).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ next_payment_date: '2026-11-19T12:00:00.000Z' }),
    )
  })
})
