import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, CheckCircle } from 'lucide-react'

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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4 animate-pulse" />
          <div className="text-gray-700">Validando link de recuperação...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Definir nova senha</h1>
          <p className="text-sm text-gray-600 mb-6">Escolha uma nova senha para sua conta</p>
          <form onSubmit={updatePassword} className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="Nova senha"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="Confirmar senha"
              />
            </div>
            <button
              type="submit"
              disabled={status==='updating'}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {status==='updating' ? 'Redefinindo...' : 'Redefinir senha'}
            </button>
          </form>
          {message && (
            <div className={`mt-4 text-sm ${status==='error' ? 'text-red-600' : 'text-green-600'}`}>{message}</div>
          )}
        </div>
        {status==='success' && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-center text-green-700">
            <CheckCircle className="w-5 h-5 inline mr-1" /> Senha atualizada!
          </div>
        )}
      </div>
    </div>
  )
}

