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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
        <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-gray-900 mb-1">Solicitação enviada</h1>
        <p className="text-gray-600 text-sm">Verifique seu email e siga o link para redefinir sua senha.</p>
      </div>
    </div>
  )
}

