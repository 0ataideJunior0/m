import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signIn } from '../utils/auth'
import { useAuthStore } from '../store/authStore'
import { Mail, Lock, Eye, EyeOff, Dumbbell, Sparkles } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; reset?: string; success?: string }>({})
  
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const errs: typeof fieldErrors = {}
      if (!emailRegex.test(email.trim())) {
        errs.email = 'Email inválido'
      }
      if (!password) {
        errs.password = 'Senha é obrigatória'
      }
      setFieldErrors(errs)
      if (Object.keys(errs).length > 0) {
        setLoading(false)
        return
      }
      const { user, error } = await signIn(email, password)
      
      if (error) {
        setError(error.message)
        return
      }

      if (user) {
        try {
          const uname = user.username || ''
          if (uname) localStorage.setItem('musa_username', uname)
        } catch {}
        setUser(user)
        navigate('/home')
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header visual */}
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Logo Musa Fit"
            className="w-20 h-20 rounded-full mx-auto mb-3 shadow-md object-contain animate-fade-in"
          />
          <div className="text-3xl font-bold text-purple-700">Musa Fit</div>
          <div className="flex items-center justify-center text-sm text-gray-600 mt-1">
            <Sparkles className="w-4 h-4 text-pink-500 mr-1" />
            20 Dias de Transformação
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 animate-slide-up">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Bem-vinda de Volta</h2>
            <p className="text-gray-600 text-sm">Entre para continuar seu progresso</p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="false" aria-label="Ícone de email">
                <Mail className="w-5 h-5" />
              </span>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFieldErrors((f) => ({ ...f, email: undefined }))
                }}
                className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="seu@email.com"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              />
            </div>
            {fieldErrors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="false" aria-label="Ícone de senha">
                <Lock className="w-5 h-5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setFieldErrors((f) => ({ ...f, password: undefined }))
                }}
                className="w-full pl-10 pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition tracking-widest"
                placeholder="Digite sua senha"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
            )}
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => navigate('/forgot')}
                className="text-sm text-purple-700 hover:text-purple-800 underline underline-offset-2"
              >
                Esqueci minha senha
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 px-4 rounded-full shadow-md hover:from-purple-700 hover:to-pink-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium transform hover:scale-[1.02] active:scale-95"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600 mt-6">
          Não tem uma conta?
          <Link to="/register" className="text-purple-600 hover:text-purple-700 font-medium ml-1">Cadastre-se</Link>
        </div>
      </div>
      </div>
    </div>
  )
}
