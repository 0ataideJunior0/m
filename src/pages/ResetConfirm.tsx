import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

export default function ResetConfirm() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate('/login'), 1500)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-surface border border-border-card rounded-3xl shadow-lg p-8 text-center max-w-md w-full">
        <CheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
        <h1 className="text-xl font-extrabold tracking-tight text-text-strong mb-1">Solicitação enviada</h1>
        <p className="text-text-muted text-sm">Verifique seu email e siga o link para redefinir sua senha.</p>
      </div>
    </div>
  )
}

