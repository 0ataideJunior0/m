import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-md mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="mb-4 p-2 rounded-lg hover:bg-black/5">
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Recuperar senha</h1>
          <p className="text-sm text-gray-600 mb-6">Informe seu email para receber o link de redefinição</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="seu@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={status==='sending' || !email}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {status==='sending' ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          </form>
          {message && (
            <div className={`mt-4 text-sm ${status==='error' ? 'text-red-600' : 'text-green-600'}`}>{message}</div>
          )}
        </div>
      </div>
    </div>
  )
}

