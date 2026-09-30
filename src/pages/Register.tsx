import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signUp } from '../utils/auth'
import { useAuthStore } from '../store/authStore'
import { getIsAdmin } from '../utils/profile'
import { Eye, EyeOff, Lock, Mail, CheckCircle2, MailCheck } from 'lucide-react'
import { passwordsMatch } from '../utils/validation'
import Button from '../components/ui/Button'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; confirmPassword?: boolean }>({})

  const navigate = useNavigate()
  const { setUser, setIsAdmin, setNeedsOnboarding } = useAuthStore()

  const validateFields = (forSubmit: boolean = false) => {
    const errs: typeof fieldErrors = {}

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

  const emailOk = !fieldErrors.email && !!email.trim()
  const passwordOk = !fieldErrors.password && !!password
  const confirmOk = !fieldErrors.confirmPassword && !!confirmPassword && confirmPassword === password
  const progressPct = Math.round(([emailOk, passwordOk, confirmOk].filter(Boolean).length / 3) * 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const ok = validateFields()
    if (!ok) return

    setLoading(true)

    try {
      const { user, error, needsEmailConfirmation } = await signUp(email.trim(), password)

      if (error) {
        setError(error.message)
        return
      }

      if (user && needsEmailConfirmation) {
        // Sem sessão ainda — logar como se tivesse dado certo deixaria a
        // tela "logada" sem token de verdade, quebrando na primeira chamada
        // autenticada. Espera a pessoa confirmar pelo email antes de seguir.
        setAwaitingConfirmation(true)
        return
      }

      if (user) {
        setUser(user)
        setIsAdmin(await getIsAdmin(user.id))
        setNeedsOnboarding(true)
        navigate('/subscribe')
      }
    } catch (err) {
      setError('Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-surface border border-border-card rounded-3xl shadow-xl p-8 text-center">
          <MailCheck className="w-12 h-12 text-accent mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">Confirme seu email</h1>
          <p className="text-text-muted mb-6">
            Enviamos um link de confirmação para <strong>{email.trim()}</strong>. Abra o email e clique no link
            para ativar sua conta.
          </p>
          <Link
            to="/login"
            className="text-accent-text hover:opacity-80 font-medium"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-surface border border-border-card rounded-3xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-text-strong mb-2">
            Musa<span className="font-accent">Fit</span>
          </h1>
          <p className="text-text-muted">Crie sua conta para começar o desafio</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center text-xs text-text-muted mb-1">
            <span>Progresso do cadastro</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-border-card rounded-full">
            <div className="h-2 bg-accent rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-muted mb-2">
              Email
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
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
                className="w-full pl-10 pr-10 px-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition"
                placeholder="seu@email.com"
              />
              {emailOk && touched.email && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-success w-5 h-5" aria-hidden="true" />
              )}
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600" role="alert" id="email-error">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-muted mb-2">
              Senha
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
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
                className="w-full pl-10 pr-10 px-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition"
                placeholder="Digite sua senha"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition"
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
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-muted mb-2">
              Confirmar Senha
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
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
                className="w-full pl-10 pr-10 px-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition"
                placeholder="Confirme sua senha"
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'confirm-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition"
                aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              {confirmOk && touched.confirmPassword && (
                <CheckCircle2 className="absolute right-10 top-1/2 -translate-y-1/2 text-success w-5 h-5" aria-hidden="true" />
              )}
            </div>
            {fieldErrors.confirmPassword && (
              <p id="confirm-error" className="mt-1 text-sm text-red-600" role="alert">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <Button type="submit" disabled={loading} isLoading={loading} className="w-full">
            Criar Conta
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-accent-text hover:opacity-80 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
