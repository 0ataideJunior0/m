import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Dumbbell, CalendarPlus, Search } from 'lucide-react'
import { listNonAdminUsers, grantAccess, AdminUserSummary } from '../../utils/adminUsers'
import { classifyAccess, filterUsers, countByFilter, AccessKind, UserFilter } from '../../utils/adminUsersView'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import ChoiceGroup from '../../components/ui/ChoiceGroup'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { cn } from '../../lib/utils'

const MONTH_OPTIONS = [
  { value: '1', label: '1 mês' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
]

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Ativas' },
  { value: 'expiring', label: 'Vencendo' },
  { value: 'expired', label: 'Vencidas' },
  { value: 'none', label: 'Sem acesso' },
]

const SOURCE_LABELS: Record<string, string> = {
  pix: 'via Pix',
  manual: 'liberado pela equipe',
}

const STATUS_CLASSES: Record<AccessKind, string> = {
  active: 'bg-success/10 text-success',
  expiring: 'bg-accent/15 text-accent-text',
  expired: 'bg-red-500/10 text-red-700 dark:text-red-400',
  none: 'bg-surface-hover text-text-muted',
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const formatMonthYear = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')

const displayName = (u: AdminUserSummary) => u.username || u.email.split('@')[0]

const initials = (u: AdminUserSummary) => {
  const parts = displayName(u).split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function StatusPill({ user }: { user: AdminUserSummary }) {
  const { kind, label } = classifyAccess(user.access)
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap', STATUS_CLASSES[kind])}>
      {label}
    </span>
  )
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<UserFilter>('all')
  const [query, setQuery] = useState('')
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const [selected, setSelected] = useState<AdminUserSummary | null>(null)
  const [months, setMonths] = useState('1')
  const [note, setNote] = useState('')
  const [granting, setGranting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setUsers(await listNonAdminUsers())
    } catch (error) {
      console.error('Error loading users:', error)
      showToast('Não foi possível carregar as alunas.')
    } finally {
      setLoading(false)
    }
  }

  const counts = useMemo(() => countByFilter(users), [users])
  const visible = useMemo(() => filterUsers(users, filter, query), [users, filter, query])

  const openGrant = (user: AdminUserSummary) => {
    setSelected(user)
    setMonths('1')
    setNote('')
  }

  const confirmGrant = async () => {
    if (!selected) return
    setGranting(true)
    try {
      const { accessUntil, error } = await grantAccess(selected.id, Number(months), note.trim() || undefined)
      if (error || !accessUntil) {
        showToast(error || 'Não foi possível liberar o acesso')
        return
      }
      showToast(`Acesso de ${displayName(selected)} liberado até ${formatDate(accessUntil)}.`, 'success')
      setSelected(null)
      await load()
    } finally {
      setGranting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  const selectedAccess = selected?.access
  const stacksOnCurrent =
    !!selectedAccess?.active && !!selectedAccess.until && new Date(selectedAccess.until) > new Date()
  const blockedByCard = !!selectedAccess?.active && selectedAccess.source === 'preapproval'

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
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong">Usuárias</h1>
            <p className="text-sm text-text-muted">
              {counts.all} {counts.all === 1 ? 'cadastrada' : 'cadastradas'} · {counts.active} com acesso
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-3 mb-5">
          <label htmlFor="user-search" className="sr-only">
            Buscar aluna
          </label>
          <Input
            id="user-search"
            type="search"
            icon={<Search className="w-5 h-5" />}
            placeholder="Buscar por nome ou e-mail"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div role="group" aria-label="Filtrar por situação" className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {FILTERS.map((f) => {
              const active = filter === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    'shrink-0 min-h-11 px-4 rounded-full text-sm font-bold whitespace-nowrap transition focus:outline-none focus:ring-2 focus:ring-focus-ring',
                    active ? 'brand-gradient shadow-md' : 'bg-surface border border-border text-text hover:bg-surface-hover'
                  )}
                >
                  {f.label} <span className={active ? 'opacity-80' : 'text-text-muted'}>{counts[f.value]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {users.length === 0 ? (
          <p className="text-text-muted text-center mt-12">Nenhuma aluna cadastrada ainda.</p>
        ) : visible.length === 0 ? (
          <div className="text-center mt-12">
            <p className="text-text-muted mb-3">Nenhuma aluna encontrada.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
              className="text-sm font-bold text-accent-text hover:opacity-80 underline"
            >
              Limpar busca e filtros
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((u) => {
              const source = u.access.source ? SOURCE_LABELS[u.access.source] : undefined
              return (
                <li key={u.id} className="bg-surface border border-border-card rounded-3xl shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="w-11 h-11 shrink-0 rounded-full bg-accent/15 text-accent-text flex items-center justify-center text-sm font-extrabold"
                    >
                      {initials(u)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-extrabold text-text-strong truncate">{displayName(u)}</span>
                        <StatusPill user={u} />
                      </div>
                      <div className="text-sm text-text-muted truncate">{u.email}</div>
                      <div className="text-xs text-text-muted mt-1">
                        Desde {formatMonthYear(u.created_at)} · {u.completedDays}{' '}
                        {u.completedDays === 1 ? 'treino' : 'treinos'}
                        {source && ` · ${source}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openGrant(u)}
                      aria-label={`Liberar acesso para ${displayName(u)}`}
                    >
                      <CalendarPlus className="w-4 h-4 mr-1.5" /> Liberar acesso
                    </Button>
                    <Link
                      to={`/admin/users/${u.id}/workout`}
                      className="inline-flex items-center px-3 py-1.5 rounded-full border border-border bg-surface text-sm font-medium text-text hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring"
                    >
                      <Dumbbell className="w-4 h-4 mr-1.5" /> Semana de treino
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Liberar acesso"
        size="card"
        footer={
          <Button className="w-full" onClick={confirmGrant} isLoading={granting} disabled={blockedByCard}>
            Liberar {MONTH_OPTIONS.find((o) => o.value === months)?.label}
          </Button>
        }
      >
        {selected && selectedAccess && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="w-11 h-11 shrink-0 rounded-full bg-accent/15 text-accent-text flex items-center justify-center text-sm font-extrabold"
              >
                {initials(selected)}
              </span>
              <div className="min-w-0">
                <div className="font-extrabold text-text-strong truncate">{displayName(selected)}</div>
                <div className="text-sm text-text-muted truncate">{selected.email}</div>
              </div>
            </div>
            <StatusPill user={selected} />

            {blockedByCard ? (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                Esta aluna tem assinatura ativa no cartão. Cancele a assinatura antes de liberar acesso manual, senão ela
                continua sendo cobrada todo mês.
              </p>
            ) : (
              <>
                <ChoiceGroup label="Quanto tempo" name="grant-months" options={MONTH_OPTIONS} value={months} onChange={setMonths} />
                <FormField label="Anotação (opcional)" htmlFor="grant-note">
                  <Input
                    id="grant-note"
                    type="text"
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex.: pago em dinheiro, R$ 49,90"
                  />
                </FormField>
                <p className="text-sm text-text-muted">
                  {stacksOnCurrent && selectedAccess.until
                    ? `Os meses entram depois do acesso atual, que vai até ${formatDate(selectedAccess.until)}.`
                    : 'O acesso começa a contar a partir de hoje.'}
                </p>
              </>
            )}
          </div>
        )}
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
