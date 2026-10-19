import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Dumbbell, CalendarPlus } from 'lucide-react'
import { listNonAdminUsers, grantAccess, AdminUserSummary, UserAccess } from '../../utils/adminUsers'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import ChoiceGroup from '../../components/ui/ChoiceGroup'
import FormField from '../../components/ui/FormField'
import Input from '../../components/ui/Input'
import Toast from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'

const MONTH_OPTIONS = [
  { value: '1', label: '1 mês' },
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '12 meses' },
]

const SOURCE_LABELS: Record<string, string> = {
  preapproval: 'cartão',
  pix: 'Pix',
  manual: 'liberado',
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

const hasActiveCard = (access: UserAccess) => access.active && access.source === 'preapproval'

function AccessBadge({ access }: { access: UserAccess }) {
  if (access.active) {
    return (
      <span className="inline-flex flex-col">
        <span className="text-sm font-bold text-success">{access.until ? `Ativo até ${formatDate(access.until)}` : 'Ativo'}</span>
        {access.source && <span className="text-xs text-text-muted">{SOURCE_LABELS[access.source] ?? access.source}</span>}
      </span>
    )
  }
  if (access.until) {
    return <span className="text-sm text-text-muted">Vencido em {formatDate(access.until)}</span>
  }
  return <span className="text-sm text-text-muted">Sem acesso</span>
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [loading, setLoading] = useState(true)
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
      const data = await listNonAdminUsers()
      setUsers(data)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

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
      showToast(`Acesso de ${selected.username || selected.email} liberado até ${formatDate(accessUntil)}.`, 'success')
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
  const blockedByCard = !!selectedAccess && hasActiveCard(selectedAccess)

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/admin')} className="mr-4 p-2 rounded-lg hover:bg-surface-hover transition">
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong">Usuárias</h1>
        </div>

        <div className="bg-surface border border-border-card rounded-3xl shadow-lg overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Email</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Username</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Cadastro</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Progresso</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Acesso</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-text">{u.email}</td>
                  <td className="px-4 py-3 text-text-muted">{u.username || '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-text-muted">{u.completedDays}/30</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AccessBadge access={u.access} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => openGrant(u)}
                        aria-label={`Liberar acesso para ${u.email}`}
                        className="inline-flex items-center gap-1 text-accent-text hover:opacity-80 text-sm font-medium"
                      >
                        <CalendarPlus className="w-4 h-4" /> Liberar acesso
                      </button>
                      <Link
                        to={`/admin/users/${u.id}/workout`}
                        className="inline-flex items-center gap-1 text-accent-text hover:opacity-80 text-sm font-medium"
                      >
                        <Dumbbell className="w-4 h-4" /> Treino pessoal
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <p className="text-text-muted text-center mt-8">Nenhuma usuária cadastrada ainda.</p>
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
            <div>
              <div className="font-bold text-text-strong break-all">{selected.username || selected.email}</div>
              {selected.username && <div className="text-sm text-text-muted break-all">{selected.email}</div>}
              <div className="mt-2">
                <AccessBadge access={selectedAccess} />
              </div>
            </div>

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
