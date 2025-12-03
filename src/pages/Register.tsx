import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signUp } from '../utils/auth'
import { useAuthStore } from '../store/authStore'
import { Eye, EyeOff, Lock, Mail, User, CheckCircle2 } from 'lucide-react'
import { passwordsMatch } from '../utils/validation'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string; password?: string; confirmPassword?: string }>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touched, setTouched] = useState<{ username?: boolean; email?: boolean; password?: boolean; confirmPassword?: boolean }>({})
  
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const validateFields = (forSubmit: boolean = false) => {
    const errs: typeof fieldErrors = {}
    const uname = username.trim()
    if (!uname) {
      errs.username = 'Nome de usuário é obrigatório'
    } else if (uname.length < 3) {
      errs.username = 'Mínimo de 3 caracteres'
    } else if (uname.length > 30) {
      errs.username = 'Máximo de 30 caracteres'
    }

    const em = email.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!em) {
      errs.email = 'Email é obrigatório'
    } else if (!emailRegex.test(em)) {
      errs.email = 'Email inválido'
    }

    const pass = password.trim()
    const conf = confirmPassword.trim()
    if (forSubmit && !pass) {
      errs.password = 'Senha é obrigatória'
    } else if (pass && pass.length < 6) {
      errs.password = 'A senha deve ter pelo menos 6 caracteres'
    }

    if (forSubmit && !conf) {
      errs.confirmPassword = 'Confirmação de senha é obrigatória'
    } else if (pass && conf && !passwordsMatch(pass, conf)) {
      errs.confirmPassword = 'As senhas não coincidem'
    }

    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const usernameOk = !fieldErrors.username && !!username.trim() && username.trim().length >= 3
  const emailOk = !fieldErrors.email && !!email.trim()
  const passwordOk = !fieldErrors.password && !!password
  const confirmOk = !fieldErrors.confirmPassword && !!confirmPassword && confirmPassword === password
  const progressPct = Math.round(([usernameOk, emailOk, passwordOk, confirmOk].filter(Boolean).length / 4) * 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const ok = validateFields()
    if (!ok) return

    setLoading(true)

    try {
      const safeUsername = username.trim()
      const { user, error } = await signUp(email.trim(), password, safeUsername)
      
      if (error) {
        setError(error.message)
        return
      }

      if (user) {
        if (safeUsername) {
          try {
            localStorage.setItem('musa_username', safeUsername)
          } catch {}
        }
        setUser(user)
        navigate('/home')
      }
    } catch (err) {
      setError('Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Musa Fit</h1>
          <p className="text-gray-600">Crie sua conta para começar o desafio</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
            <span>Progresso do cadastro</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-pink-100 rounded-full">
            <div className="h-2 bg-purple-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Nome de Usuária
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <User className="w-5 h-5" />
              </span>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (error) setError('')
                  validateFields()
                }}
                onBlur={() => setTouched(t => ({ ...t, username: true }))}
                className="w-full pl-10 pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="ex: mariafit"
              />
              {usernameOk && touched.username && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 w-5 h-5" aria-hidden="true" />
              )}
            </div>
            {fieldErrors.username && (
              <p className="mt-1 text-sm text-red-600" role="alert" id="username-error">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <Mail className="w-5 h-5" />
              </span>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError('')
                  validateFields()
                }}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                className="w-full pl-10 pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="seu@email.com"
              />
              {emailOk && touched.email && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 w-5 h-5" aria-hidden="true" />
              )}
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600" role="alert" id="email-error">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <Lock className="w-5 h-5" />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                setPassword(e.target.value)
                setFieldErrors(f => ({ ...f, confirmPassword: undefined }))
                if (error) setError('')
                validateFields(false)
              }}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
                className="w-full pl-10 pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="Digite sua senha"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Senha
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <Lock className="w-5 h-5" />
              </span>
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                setConfirmPassword(e.target.value)
                setFieldErrors(f => ({ ...f, confirmPassword: undefined }))
                if (error) setError('')
                validateFields(false)
              }}
                onBlur={() => setTouched(t => ({ ...t, confirmPassword: true }))}
                className="w-full pl-10 pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="Confirme sua senha"
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'confirm-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              {confirmOk && touched.confirmPassword && (
                <CheckCircle2 className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500 w-5 h-5" aria-hidden="true" />
              )}
            </div>
            
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-purple-600 hover:text-purple-700 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
