import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { computeFunnel, loadFunnelData, FunnelResult } from '../../utils/funnel'
import { resendAccess } from '../../utils/checkout'
import Button from '../../components/ui/Button'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/utils'

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
]

const DAY_MS = 24 * 60 * 60 * 1000

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

/** Porcentagem em relação à etapa anterior; "—" quando não há base para dividir. */
const percentOfPrevious = (count: number, previous: number | null) => {
  if (previous === null) return '100%'
  if (previous === 0) return '—'
  return `${Math.round((count / previous) * 100)}%`
}

export default function AdminFunnel() {
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [funnel, setFunnel] = useState<FunnelResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const { toast, show: showToast, dismiss: dismissToast } = useToast()
  const requestId = useRef(0)

  const load = useCallback(async (period: number) => {
    const current = ++requestId.current
    setLoading(true)
    setFailed(false)
    try {
      const since = new Date(Date.now() - period * DAY_MS)
      const data = await loadFunnelData(since)
      if (current !== requestId.current) return
      setFunnel(computeFunnel(data.intents, data.onboardedUserIds, data.firstWorkoutUserIds, since))
    } catch (error) {
      if (current !== requestId.current) return
      console.error('Error loading funnel:', error)
      setFailed(true)
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(days)
  }, [days, load])

  const firstCount = funnel?.steps[0]?.count ?? 0
  const steps = useMemo(
    () =>
      (funnel?.steps ?? []).map((step, index, all) => ({
        ...step,
        percent: percentOfPrevious(step.count, index === 0 ? null : all[index - 1].count),
        width: firstCount > 0 ? Math.max((step.count / firstCount) * 100, step.count > 0 ? 2 : 0) : 0,
      })),
    [funnel, firstCount],
  )

  const resend = async (email: string) => {
    setResending(email)
    try {
      const result = await resendAccess(email)
      if (result.ok) showToast(`Acesso reenviado para ${email}.`, 'success')
      else showToast(result.error || 'Não foi possível reenviar o acesso.')
    } finally {
      setResending(null)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-16">
        <header className="flex items-center gap-2 mb-5">
          <button
            onClick={() => navigate('/admin')}
            aria-label="Voltar ao painel"
            className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-surface-hover transition"
          >
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong">Funil</h1>
            <p className="text-sm text-text-muted">Onde as compradoras param e de onde vêm as vendas</p>
          </div>
        </header>

        <div role="group" aria-label="Período" className="flex gap-2 mb-5">
          {PERIODS.map((p) => {
            const active = days === p.days
            return (
              <button
                key={p.days}
                type="button"
                aria-pressed={active}
                onClick={() => setDays(p.days)}
                className={cn(
                  'shrink-0 min-h-11 px-4 rounded-full text-sm font-bold whitespace-nowrap transition focus:outline-none focus:ring-2 focus:ring-focus-ring',
                  active ? 'brand-gradient shadow-md' : 'bg-surface border border-border text-text hover:bg-surface-hover',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              role="status"
              aria-label="Carregando"
              className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin"
            />
          </div>
        ) : failed || !funnel ? (
          <div className="text-center py-12">
            <p role="alert" className="text-text-muted mb-4">
              Não foi possível carregar o funil.
            </p>
            <Button variant="secondary" onClick={() => load(days)}>
              Tentar de novo
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-surface border border-border-card rounded-3xl shadow-sm p-5">
              <h2 className="text-lg font-extrabold text-text-strong mb-1">Etapas</h2>
              <p className="text-xs text-text-muted mb-4">Pessoas (e-mails distintos). A % é em relação à etapa anterior.</p>
              <ul className="space-y-4">
                {steps.map((step) => (
                  <li key={step.key}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-sm font-bold text-text-strong">{step.label}</span>
                      <span className="text-sm text-text-muted whitespace-nowrap">
                        <span className="font-extrabold text-text-strong">{step.count}</span> ·{' '}
                        <span>{step.percent}</span>
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-surface-hover overflow-hidden" aria-hidden="true">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${step.width}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-surface border border-border-card rounded-3xl shadow-sm p-5">
              <h2 className="text-lg font-extrabold text-text-strong mb-3">Por origem</h2>
              {funnel.bySource.length === 0 ? (
                <p className="text-sm text-text-muted">Nenhum checkout neste período.</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-1 py-2 text-sm font-medium text-text-muted">Origem</th>
                        <th className="px-1 py-2 text-sm font-medium text-text-muted text-right">Checkout</th>
                        <th className="px-1 py-2 text-sm font-medium text-text-muted text-right">Pagaram</th>
                        <th className="px-1 py-2 text-sm font-medium text-text-muted text-right">Conversão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funnel.bySource.map((row) => (
                        <tr key={row.source} className="border-b border-border last:border-0">
                          <td className="px-1 py-2.5 text-text">{row.source}</td>
                          <td className="px-1 py-2.5 text-text text-right">{row.checkout}</td>
                          <td className="px-1 py-2.5 text-text text-right">{row.paid}</td>
                          <td className="px-1 py-2.5 text-text-muted text-right">{percentOfPrevious(row.paid, row.checkout)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-surface border border-border-card rounded-3xl shadow-sm p-5">
              <h2 className="text-lg font-extrabold text-text-strong mb-3">Pagaram e não criaram a senha</h2>
              {funnel.paidWithoutPassword.length === 0 ? (
                <p className="text-sm text-text-muted">Ninguém pendente neste período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {funnel.paidWithoutPassword.map((intent) => (
                    <li key={intent.email} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <div className="text-text truncate">{intent.email}</div>
                        <div className="text-xs text-text-muted">Pagou em {formatDate(intent.paid_at)}</div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={resending === intent.email}
                        disabled={resending !== null}
                        onClick={() => resend(intent.email)}
                        aria-label={`Reenviar acesso para ${intent.email}`}
                      >
                        <Mail className="w-4 h-4 mr-1.5" /> Reenviar acesso
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
