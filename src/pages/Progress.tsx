import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getUserProgress, getCurrentDay } from '../utils/workouts'
import { UserProgress } from '../types'
import { Check, Circle, ArrowRight, ArrowLeft } from 'lucide-react'

export default function Progress() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    loadProgress()
  }, [isAuthenticated, navigate])

  const loadProgress = async () => {
    if (!user) return

    try {
      const userProgress = await getUserProgress(user.id)
      setProgress(userProgress)
    } catch (error) {
      console.error('Error loading progress:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-purple-200 rounded w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-purple-200 rounded w-24 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const currentDay = getCurrentDay(progress)
  const completedDays = progress.filter(p => p.completed).length

  // Generate all 20 days
  const allDays = Array.from({ length: 20 }, (_, i) => {
    const dayNumber = i + 1
    const dayProgress = progress.find(p => p.day_number === dayNumber)
    
    return {
      dayNumber,
      completed: dayProgress?.completed || false,
      isCurrent: dayNumber === currentDay && !dayProgress?.completed,
      isLocked: dayNumber > currentDay,
    }
  })

  const getDayIcon = (day: typeof allDays[0]) => {
    if (day.completed) {
      return <Check className="w-6 h-6 text-white" />
    } else if (day.isCurrent) {
      return <ArrowRight className="w-6 h-6 text-purple-600" />
    } else if (day.isLocked) {
      return <Circle className="w-6 h-6 text-gray-300" />
    } else {
      return <Circle className="w-6 h-6 text-gray-400" />
    }
  }

  const getDayStyle = (day: typeof allDays[0]) => {
    if (day.completed) {
      return 'bg-green-500 border-green-500'
    } else if (day.isCurrent) {
      return 'bg-purple-100 border-purple-300'
    } else if (day.isLocked) {
      return 'bg-gray-50 border-gray-200'
    } else {
      return 'bg-white border-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/home')}
            className="mr-4 p-2 rounded-lg hover:bg-white/50 transition"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Progresso do Desafio</h1>
            <p className="text-gray-600">Acompanhe sua jornada de 20 dias</p>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {completedDays}/20
            </div>
            <div className="text-gray-600 mb-4">dias completados</div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(completedDays / 20) * 100}%` }}
              ></div>
            </div>

            {currentDay <= 20 ? (
              <p className="text-purple-600 font-medium">
                🎯 Você está no dia {currentDay} do desafio
              </p>
            ) : (
              <p className="text-green-600 font-medium">
                🎉 Parabéns! Você completou todos os 20 dias!
              </p>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Timeline do Desafio</h2>
          
          <div className="space-y-4">
            {allDays.map((day) => (
              <div key={day.dayNumber} className="flex items-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 mr-4">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${getDayStyle(day)}`}>
                    {getDayIcon(day)}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-medium ${
                        day.completed ? 'text-green-700' : 
                        day.isCurrent ? 'text-purple-700' : 
                        day.isLocked ? 'text-gray-400' : 'text-gray-700'
                      }`}>
                        Dia {day.dayNumber}
                      </h3>
                      <p className={`text-sm ${
                        day.completed ? 'text-green-600' : 
                        day.isCurrent ? 'text-purple-600' : 
                        day.isLocked ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {day.completed && 'Concluído ✓'}
                        {day.isCurrent && 'Dia atual →'}
                        {day.isLocked && 'Bloqueado'}
                        {!day.completed && !day.isCurrent && !day.isLocked && 'Pendente'}
                      </p>
                    </div>
                    
                    {!day.isLocked && (
                      <button
                        onClick={() => navigate(`/workout/${day.dayNumber}`)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          day.completed 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        {day.completed ? 'Ver Treino' : 'Iniciar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grade Semanal */}
        <div className="bg-gray-900 text-white rounded-2xl shadow-lg p-6 mt-8">
          <h2 className="text-xl font-bold mb-6">Grade Semanal (3 semanas)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-4">Semana</th>
                  <th className="py-2 px-4">Seg</th>
                  <th className="py-2 px-4">Ter</th>
                  <th className="py-2 px-4">Qua</th>
                  <th className="py-2 px-4">Qui</th>
                  <th className="py-2 px-4">Sex</th>
                  <th className="py-2 px-4">Sáb</th>
                  <th className="py-2 px-4">Dom</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/10">
                  <td className="py-3 pr-4 font-semibold">Semana 1</td>
                  <td className="py-3 px-4">M-A (D1)</td>
                  <td className="py-3 px-4">M-B (D2)</td>
                  <td className="py-3 px-4">M-C (D3)</td>
                  <td className="py-3 px-4">M-D (D4)</td>
                  <td className="py-3 px-4">M-E (D5)</td>
                  <td className="py-3 px-4">M-F (D6)</td>
                  <td className="py-3 px-4">M-G (D7)</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="py-3 pr-4 font-semibold">Semana 2</td>
                  <td className="py-3 px-4">M-A (D8)</td>
                  <td className="py-3 px-4">M-B (D9)</td>
                  <td className="py-3 px-4">M-C (D10)</td>
                  <td className="py-3 px-4">M-D (D11)</td>
                  <td className="py-3 px-4">M-E (D12)</td>
                  <td className="py-3 px-4">M-F (D13)</td>
                  <td className="py-3 px-4">M-G (D14)</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="py-3 pr-4 font-semibold">Semana 3</td>
                  <td className="py-3 px-4">M-A (D15)</td>
                  <td className="py-3 px-4">M-B (D16)</td>
                  <td className="py-3 px-4">M-C (D17)</td>
                  <td className="py-3 px-4">M-D (D18)</td>
                  <td className="py-3 px-4">M-E (D19)</td>
                  <td className="py-3 px-4">M-F (D20)</td>
                  <td className="py-3 px-4">DESCANSO</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => {
                const header = ['Semana','Seg','Ter','Qua','Qui','Sex','Sáb','Dom']
                const rows = [
                  ['Semana 1','M-A (D1)','M-B (D2)','M-C (D3)','M-D (D4)','M-E (D5)','M-F (D6)','M-G (D7)'],
                  ['Semana 2','M-A (D8)','M-B (D9)','M-C (D10)','M-D (D11)','M-E (D12)','M-F (D13)','M-G (D14)'],
                  ['Semana 3','M-A (D15)','M-B (D16)','M-C (D17)','M-D (D18)','M-E (D19)','M-F (D20)','DESCANSO'],
                ]
                const csv = [header, ...rows].map(r => r.join(',')).join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'musa_grade_semanal_3semanas.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg hover:bg-white/90"
            >
              Exportar para as Planilhas
            </button>
            <div className="w-6 h-6 rounded bg-white/10"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
