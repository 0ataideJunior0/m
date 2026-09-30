import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, CheckCircle } from 'lucide-react'
import Button from '../components/ui/Button'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<'idle'|'updating'|'success'|'error'>('idle')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setReady(!!session)
    }
    check()
  }, [])

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password.length < 6 || password !== confirm) {
      setMessage('Verifique a senha: mínimo 6 caracteres e igual à confirmação')
      setStatus('error')
      return
    }
    setStatus('updating')
    setMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStatus('success')
      setMessage('Senha redefinida com sucesso')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err: any) {
      setStatus('error')
      setMessage(err?.message || 'Não foi possível redefinir a senha')
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-border-card rounded-full mx-auto mb-4 animate-pulse" />
          <div className="text-text-muted">Validando link de recuperação...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">Definir nova senha</h1>
          <p className="text-sm text-text-muted mb-6">Escolha uma nova senha para sua conta</p>
          <form onSubmit={updatePassword} className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition"
                placeholder="Nova senha"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition"
                placeholder="Confirmar senha"
              />
            </div>
            <Button type="submit" disabled={status==='updating'} isLoading={status==='updating'} className="w-full">
              Redefinir senha
            </Button>
          </form>
          {message && (
            <div className={`mt-4 text-sm ${status==='error' ? 'text-red-600 dark:text-red-400' : 'text-success'}`}>{message}</div>
          )}
        </div>
        {status==='success' && (
          <div className="mt-4 bg-success/10 border border-success/30 rounded-lg p-3 text-center text-success">
            <CheckCircle className="w-5 h-5 inline mr-1" /> Senha atualizada!
          </div>
        )}
      </div>
    </div>
  )
}

