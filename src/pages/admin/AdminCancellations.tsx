import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { listCancellationFeedback, CancellationFeedbackRow } from '../../utils/adminCancellations'
import { CANCELLATION_REASONS_DISPLAY } from '../../utils/cancellationReasons'

export default function AdminCancellations() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<CancellationFeedbackRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const data = await listCancellationFeedback()
      setRows(data)
    } catch (error) {
      console.error('Error loading cancellation feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin" />
      </div>
    )
  }

  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.reason, (counts.get(row.reason) || 0) + 1)

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <button onClick={() => navigate('/admin')} className="mr-4 p-2 rounded-lg hover:bg-surface-hover transition">
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-text-strong">Motivos de cancelamento</h1>
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {CANCELLATION_REASONS_DISPLAY.map((r) => (
              <div key={r.value} className="bg-surface border border-border-card rounded-2xl shadow p-3 text-center">
                <div className="text-2xl font-bold text-accent">{counts.get(r.value) || 0}</div>
                <div className="text-xs text-text-muted mt-1">{r.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-surface border border-border-card rounded-3xl shadow-lg overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Email</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Motivo</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Comentário</th>
                <th className="px-4 py-3 text-sm font-medium text-text-muted">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3 text-text whitespace-nowrap">{r.email}</td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{r.reasonLabel}</td>
                  <td className="px-4 py-3 text-text-muted">{r.comment || '—'}</td>
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="text-text-muted text-center mt-8">Nenhum cancelamento registrado ainda.</p>
        )}
      </div>
    </div>
  )
}
