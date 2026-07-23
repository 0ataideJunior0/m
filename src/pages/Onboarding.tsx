import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { updateProfileFields } from '../utils/profile'
import { Goal, Sex } from '../types'
import FormField from '../components/ui/FormField'
import Input from '../components/ui/Input'
import ChoiceGroup from '../components/ui/ChoiceGroup'
import Button from '../components/ui/Button'

const TOTAL_STEPS = 6

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
]

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'emagrecer', label: 'Emagrecer' },
  { value: 'ganhar_musculo', label: 'Ganhar músculo' },
  { value: 'manter', label: 'Manter' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, isAuthenticated, setUser, setNeedsOnboarding } = useAuthStore()

  const [step, setStep] = useState(0)
  const [nome, setNome] = useState('')
  const [idade, setIdade] = useState('')
  const [sexo, setSexo] = useState<Sex | null>(null)
  const [objetivo, setObjetivo] = useState<Goal | null>(null)
  const [altura, setAltura] = useState('')
  const [peso, setPeso] = useState('')
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  const progressPct = Math.round(((step + 1) / TOTAL_STEPS) * 100)

  const validateStep = (): boolean => {
    setFieldError('')
    if (step === 0) {
      if (nome.trim().length < 2) {
        setFieldError('Digite pelo menos 2 caracteres')
        return false
      }
    } else if (step === 1) {
      const n = parseInt(idade, 10)
      if (!idade || isNaN(n) || n <= 0 || n >= 120) {
        setFieldError('Digite uma idade válida')
        return false
      }
    } else if (step === 2) {
      if (!sexo) {
        setFieldError('Selecione uma opção')
        return false
      }
    } else if (step === 3) {
      if (!objetivo) {
        setFieldError('Selecione uma opção')
        return false
      }
    } else if (step === 4) {
      const n = parseInt(altura, 10)
      if (!altura || isNaN(n) || n < 50 || n > 250) {
        setFieldError('Digite uma altura válida (em cm)')
        return false
      }
    } else if (step === 5) {
      const n = parseFloat(peso)
      if (!peso || isNaN(n) || n <= 0) {
        setFieldError('Digite um peso válido (em kg)')
        return false
      }
    }
    return true
  }

  const handleNext = async () => {
    if (!validateStep()) return

    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1)
      return
    }

    if (!user) return
    setSaving(true)
    setError('')
    try {
      const { error: updateError } = await updateProfileFields(user.id, {
        username: nome.trim(),
        age: parseInt(idade, 10),
        sex: sexo as Sex,
        goal: objetivo as Goal,
        height_cm: parseInt(altura, 10),
        weight_kg: parseFloat(peso),
        onboarding_completed_at: new Date().toISOString(),
      })

      if (updateError) {
        setError('Não foi possível salvar seus dados. Tente novamente.')
        return
      }

      setUser({
        ...user,
        username: nome.trim(),
        age: parseInt(idade, 10),
        sex: sexo,
        goal: objetivo,
        heightCm: parseInt(altura, 10),
        weightKg: parseFloat(peso),
        onboardingCompletedAt: new Date().toISOString(),
      })
      setNeedsOnboarding(false)
      navigate('/home')
    } catch {
      setError('Não foi possível salvar seus dados. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    setFieldError('')
    setStep((s) => Math.max(0, s - 1))
  }

  if (!isAuthenticated || !user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Vamos te conhecer</h1>
          <p className="text-gray-600 text-sm">Passo {step + 1} de {TOTAL_STEPS}</p>
        </div>

        <div className="mb-8">
          <div className="w-full h-2 bg-pink-100 rounded-full">
            <div className="h-2 bg-purple-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <div className="mb-8">
          {step === 0 && (
            <FormField label="Como podemos te chamar?" htmlFor="nome" error={fieldError}>
              <Input
                id="nome"
                type="text"
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
              />
            </FormField>
          )}

          {step === 1 && (
            <FormField label="Qual sua idade?" htmlFor="idade" error={fieldError}>
              <Input
                id="idade"
                type="number"
                inputMode="numeric"
                step="1"
                autoFocus
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
                placeholder="Anos"
              />
            </FormField>
          )}

          {step === 2 && (
            <ChoiceGroup
              label="Qual seu sexo?"
              name="sexo"
              options={SEX_OPTIONS}
              value={sexo}
              onChange={(v) => setSexo(v as Sex)}
              error={fieldError}
            />
          )}

          {step === 3 && (
            <ChoiceGroup
              label="Qual seu objetivo?"
              name="objetivo"
              options={GOAL_OPTIONS}
              value={objetivo}
              onChange={(v) => setObjetivo(v as Goal)}
              error={fieldError}
            />
          )}

          {step === 4 && (
            <FormField label="Qual sua altura? (cm)" htmlFor="altura" error={fieldError}>
              <Input
                id="altura"
                type="number"
                inputMode="numeric"
                step="1"
                autoFocus
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="Ex: 165"
              />
            </FormField>
          )}

          {step === 5 && (
            <FormField label="Qual seu peso? (kg)" htmlFor="peso" error={fieldError}>
              <Input
                id="peso"
                type="number"
                inputMode="decimal"
                step="0.1"
                autoFocus
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                placeholder="Ex: 62.5"
              />
            </FormField>
          )}
        </div>

        <div className="flex items-center gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={handleBack} disabled={saving}>
              Voltar
            </Button>
          )}
          <Button variant="primary" onClick={handleNext} isLoading={saving} className="flex-1">
            {step === TOTAL_STEPS - 1 ? 'Concluir' : 'Próximo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
