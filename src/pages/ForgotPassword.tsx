import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setMessage('')
    try {
      const redirectTo = `${window.location.origin}/reset`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (error) throw error
      setStatus('sent')
      setMessage('Verifique seu email para o link de redefinição')
      setTimeout(() => navigate('/reset-confirm'), 800)
    } catch (err: any) {
      setStatus('error')
      setMessage(err?.message || 'Não foi possível enviar o link de redefinição')
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-md mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="mb-4 p-2 rounded-lg hover:bg-surface-hover">
          <ChevronLeft className="w-6 h-6 text-text" />
        </button>
        <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">Recuperar senha</h1>
          <p className="text-sm text-text-muted mb-6">Informe seu email para receber o link de redefinição</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition"
                placeholder="seu@email.com"
              />
            </div>
            <Button type="submit" disabled={status==='sending' || !email} isLoading={status==='sending'} className="w-full">
              Enviar link de recuperação
            </Button>
          </form>
          {message && (
            <div className={`mt-4 text-sm ${status==='error' ? 'text-red-600 dark:text-red-400' : 'text-success'}`}>{message}</div>
          )}
        </div>
      </div>
    </div>
  )
}

