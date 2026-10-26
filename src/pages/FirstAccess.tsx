import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { claimAccess, resendAccess } from '../utils/checkout'
import { getCurrentUser } from '../utils/auth'
import { getIsAdmin } from '../utils/profile'
import { getHasActiveSubscription } from '../utils/subscription'
import { useAuthStore } from '../store/authStore'
import { passwordsMatch } from '../utils/validation'
import { authErrorMessage, isSamePasswordError } from '../utils/authErrors'
import { Eye, EyeOff, Lock, Mail, MailCheck } from 'lucide-react'
import Button from '../components/ui/Button'
import AmbientGlow from '../components/ui/AmbientGlow'

type Phase = 'loading' | 'ready' | 'expired'

// A sessão do link vem no hash da URL e o supabase-js a lê de forma assíncrona:
// dá uma folga antes de concluir que o link não vale mais.
const SESSION_GRACE_MS = 1500

export default function FirstAccess() {
  const [phase, setPhase] = useState<Phase>('loading')
  const claimedRef = useRef(false)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendError, setResendError] = useState('')

  const navigate = useNavigate()
  const { setUser, setIsAdmin, setNeedsOnboarding, setHasActiveSubscription } = useAuthStore()

  useEffect(() => {
    let active = true
    let graceTimer: ReturnType<typeof setTimeout> | undefined

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setPhase('ready')
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session) {
        setPhase('ready')
        return
      }
      graceTimer = setTimeout(async () => {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        setPhase((current) => (data.session || current === 'ready' ? 'ready' : 'expired'))
      }, SESSION_GRACE_MS)
    })

    return () => {
      active = false
      clearTimeout(graceTimer)
      subscription.unsubscribe()
    }
  }, [])

  // Uma vez por abertura do link (o ref segura o efeito duplo do StrictMode).
  // O resultado não muda a tela: se o servidor recusar, a senha ainda é criada.
  useEffect(() => {
    if (phase !== 'ready' || claimedRef.current) return
    claimedRef.current = true
    claimAccess('link_opened').then(({ ok, error: claimError }) => {
      if (!ok) console.error('Não foi possível registrar a abertura do link:', claimError)
    })
  }, [phase])

  const validate = () => {
    const errs: typeof fieldErrors = {}
    const pass = password.trim()
    const conf = confirmPassword.trim()
    if (!pass) {
      errs.password = 'Senha é obrigatória'
    } else if (pass.length < 6) {
      errs.password = 'A senha deve ter pelo menos 6 caracteres'
    }
    if (!conf) {
      errs.confirmPassword = 'Confirmação de senha é obrigatória'
    } else if (pass && !passwordsMatch(pass, conf)) {
      errs.confirmPassword = 'As senhas não coincidem'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      // Senha igual à atual (ex.: reabriu o link e digitou a mesma): a senha
      // que ela quer já está valendo, então segue como sucesso.
      if (updateError && !isSamePasswordError(updateError)) {
        setError(authErrorMessage(updateError))
        return
      }

      // Revoga qualquer outra sessão desta conta (ex.: alguém que cadastrou o
      // e-mail antes da compradora). Falhar aqui não pode travar quem pagou.
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
        if (signOutError) console.error('Não foi possível encerrar as outras sessões:', signOutError)
      } catch (signOutFailure) {
        console.error('Não foi possível encerrar as outras sessões:', signOutFailure)
      }

      const { ok, error: claimError } = await claimAccess('password_set')
      if (!ok) console.error('Não foi possível registrar a senha criada:', claimError)

      // Mesma hidratação do Login. Se não der, a senha já está salva: manda entrar.
      const user = await getCurrentUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)
      setIsAdmin(await getIsAdmin(user.id))
      const needsOnboarding = !user.onboardingCompletedAt
      setNeedsOnboarding(needsOnboarding)
      setHasActiveSubscription(await getHasActiveSubscription())
      navigate(needsOnboarding ? '/onboarding' : '/home')
    } catch {
      setError('Erro ao salvar a senha. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    const target = resendEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setResendError('Digite um e-mail válido.')
      return
    }
    setResendError('')
    setResendLoading(true)
    const { ok, error: resendFailure } = await resendAccess(target)
    setResendLoading(false)
    if (!ok) {
      setResendError(resendFailure || 'Não foi possível enviar o link. Tente de novo.')
      return
    }
    setResendSent(true)
  }

  const inputClass =
    'w-full pl-10 pr-10 px-4 py-3 border border-border bg-surface-sunken text-text rounded-xl focus:ring-2 focus:ring-focus-ring focus:border-transparent outline-none transition'

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-border-card rounded-full mx-auto mb-4 animate-pulse" />
          <div className="text-text-muted">Validando seu link de acesso...</div>
        </div>
      </div>
    )
  }

  if (phase === 'expired') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative overflow-hidden">
        <AmbientGlow className="w-96 h-96 -top-32 -right-24" />
        <div className="max-w-md w-full bg-surface border border-border-card rounded-3xl shadow-xl p-8">
          <div className="text-center mb-6">
            <MailCheck className="w-12 h-12 text-accent mx-auto mb-4" aria-hidden="true" />
            <h1 className="text-2xl font-extrabold tracking-tight text-text-strong mb-2">
              Este link expirou ou já foi usado.
            </h1>
            <p className="text-text-muted">
              Digite o e-mail da sua compra e enviamos um novo link de acesso.
            </p>
          </div>

          <form onSubmit={handleResend} className="space-y-4" noValidate>
            <div>
              <label htmlFor="resend-email" className="block text-sm font-medium text-text-muted mb-2">
                E-mail
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  id="resend-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={resendEmail}
                  onChange={(e) => {
                    setResendEmail(e.target.value)
                    if (resendError) setResendError('')
                  }}
                  className={inputClass}
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            <Button type="submit" disabled={resendLoading} isLoading={resendLoading} className="w-full">
              Enviar novo link
            </Button>
            {resendSent && (
              <p role="status" className="text-sm text-text-muted">
                Pronto. Se houver uma compra com esse e-mail, o link novo chega em instantes. Confira também o spam.
              </p>
            )}
            {resendError && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">{resendError}</p>
            )}
          </form>

          <p className="text-center text-sm text-text-muted mt-6">
            Já tem senha?{' '}
            <Link to="/login" className="text-accent-text hover:opacity-80 font-medium">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative overflow-hidden">
      <AmbientGlow className="w-96 h-96 -top-32 -right-24" />
      <div className="max-w-md w-full bg-surface border border-border-card rounded-3xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-text-strong mb-2">Crie sua senha</h1>
          <p className="text-text-muted">
            Pagamento confirmado! Falta só criar a senha para entrar sempre que quiser.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {error && (
            <div
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

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
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setFieldErrors((f) => ({ ...f, password: undefined, confirmPassword: undefined }))
                  if (error) setError('')
                }}
                className={inputClass}
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
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setFieldErrors((f) => ({ ...f, confirmPassword: undefined }))
                  if (error) setError('')
                }}
                className={inputClass}
                placeholder="Confirme sua senha"
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'confirm-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition"
                aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p id="confirm-error" className="mt-1 text-sm text-red-600" role="alert">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <Button type="submit" disabled={saving} isLoading={saving} className="w-full">
            Salvar senha
          </Button>
        </form>
      </div>
    </div>
  )
}
