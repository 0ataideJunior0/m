import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { signIn } from '../utils/auth'
import { useAuthStore } from '../store/authStore'
import { getIsAdmin } from '../utils/profile'
import { getHasActiveSubscription } from '../utils/subscription'
import { resendAccess } from '../utils/checkout'
import { Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'
import Button from '../components/ui/Button'
import AmbientGlow from '../components/ui/AmbientGlow'

const RESEND_COOLDOWN_MS = 60_000

export default function Login() {
  const [searchParams] = useSearchParams()
  // Vindo do checkout: a conta foi criada pelo pagamento e o link de acesso foi
  // por e-mail. O e-mail da URL só preenche o campo; quem manda é o servidor.
  const justPaid = searchParams.get('pago') === '1'
  const paidEmail = justPaid ? searchParams.get('email')?.trim() ?? '' : ''

  const [email, setEmail] = useState(paidEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; reset?: string; success?: string }>({})

  const [resendSent, setResendSent] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendError, setResendError] = useState('')
  const resendTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(resendTimer.current), [])

  const navigate = useNavigate()
  const { setUser, setIsAdmin, setNeedsOnboarding, setHasActiveSubscription } = useAuthStore()

  const handleResend = async () => {
    const target = paidEmail || email.trim()
    if (!target) {
      setResendError('Digite seu e-mail para reenviar o link.')
      return
    }
    setResendError('')
    setResendLoading(true)
    const { ok, error: resendFailure } = await resendAccess(target)
    setResendLoading(false)
    if (!ok) {
      setResendError(resendFailure || 'Não foi possível reenviar o link. Tente de novo.')
      return
    }
    setResendSent(true)
    resendTimer.current = setTimeout(() => setResendSent(false), RESEND_COOLDOWN_MS)
  }

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
        setUser(user)
        setIsAdmin(await getIsAdmin(user.id))
        setNeedsOnboarding(!user.onboardingCompletedAt)
        setHasActiveSubscription(await getHasActiveSubscription())
        navigate('/home')
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative overflow-hidden">
      <AmbientGlow className="w-96 h-96 -top-32 -right-24" />
      <div className="max-w-md w-full">
        {/* Header visual */}
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Logo MusaFit"
            className="w-20 h-20 rounded-full mx-auto mb-3 shadow-md object-contain animate-fade-in"
          />
          <div className="text-3xl font-extrabold tracking-tight text-text-strong">
            Musa<span className="font-accent">Fit</span>
          </div>
          <div className="flex items-center justify-center text-sm text-text-muted mt-1">
            <Sparkles className="w-4 h-4 text-accent mr-1" />
            Destrave sua Transformação
          </div>
        </div>

        <div className="bg-surface border border-border-card rounded-3xl shadow-xl p-8 animate-slide-up">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-text-strong">
              Bem-vinda de <span className="font-accent">Volta</span>
            </h2>
            <p className="text-text-muted text-sm">Entre para continuar seu progresso</p>
          </div>

          {justPaid && (
            <div className="mb-6 rounded-2xl border border-accent bg-surface-hover px-4 py-3 text-sm text-text">
              <p>
                {`Pagamento recebido! Se for seu primeiro acesso, enviamos um link para ${paidEmail || 'o seu e-mail'} — confira também a caixa de spam. Se você já tem conta, é só entrar com sua senha.`}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={handleResend}
                disabled={resendSent}
                isLoading={resendLoading}
              >
                Reenviar link
              </Button>
              {resendSent && (
                <p role="status" className="mt-2 text-text-muted">Enviado. Aguarde 1 minuto para pedir de novo.</p>
              )}
              {resendError && (
                <p role="alert" className="mt-2 text-red-700 dark:text-red-400">{resendError}</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-muted mb-2">Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="false" aria-label="Ícone de email">
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
                  className="w-full pl-10 px-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition"
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
              <label htmlFor="password" className="block text-sm font-medium text-text-muted mb-2">Senha</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="false" aria-label="Ícone de senha">
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
                  className="w-full pl-10 pr-10 px-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition tracking-widest"
                  placeholder="Digite sua senha"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition"
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
                  className="text-sm text-accent-text hover:opacity-80 underline underline-offset-2"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} isLoading={loading} className="w-full">
              Entrar
            </Button>
          </form>

          <div className="text-center text-sm text-text-muted mt-6">
            Não tem uma conta?
            <Link to="/register" className="text-accent-text hover:opacity-80 font-medium ml-1">Cadastre-se</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
