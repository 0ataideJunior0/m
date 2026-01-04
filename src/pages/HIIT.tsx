import { ChevronLeft, Flame, Timer, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function HIIT() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate('/home')} className="mr-3 p-2 rounded-lg hover:bg-black/5 transition">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <div className="flex items-center">
            <Flame className="w-6 h-6 text-red-500 mr-2" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">HIIT disponível a partir da segunda semana.</h1>
          </div>
        </div>

        {/* <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center text-gray-700 mb-2">
            <Timer className="w-5 h-5 mr-2" />
            <span>Formato: 40s ON / 20s OFF </span>
          </div>
          <div className="text-sm text-gray-600">Este treino é opcional e não impacta seu progresso do desafio.</div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-lg font-bold text-gray-900 mb-2">Aquecimento • 3 minutos</div>
          <ul className="space-y-2 text-gray-700">
            <li>Marcha acelerada / corrida no lugar – 1min</li>
            <li>Polichinelos – 1min</li>
            <li>Mobilidade (giros de quadril + tronco) – 1min</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-2">
            <Zap className="w-5 h-5 text-pink-500 mr-2" />
            <div className="text-lg font-bold text-gray-900">Bloco 1 • 8 minutos</div>
          </div>
          <div className="text-sm text-gray-600 mb-4">Repita 2x</div>
          <ul className="space-y-2 text-gray-700">
            <li>Burpees – 40s ON / 20s OFF</li>
            <li>High Knees – 40s ON / 20s OFF</li>
            <li>Jump Squat – 40s ON / 20s OFF</li>
            <li>Mountain Climbers – 40s ON / 20s OFF</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-2">
            <Zap className="w-5 h-5 text-green-500 mr-2" />
            <div className="text-lg font-bold text-gray-900">Bloco 2 • 8 minutos</div>
          </div>
          <div className="text-sm text-gray-600 mb-4">Repita 2x</div>
          <ul className="space-y-2 text-gray-700">
            <li>Prancha + toque no ombro – 40s ON / 20s OFF</li>
            <li>Abdominal bicicleta – 40s ON / 20s OFF</li>
            <li>Elevação de pernas – 40s ON / 20s OFF</li>
            <li>Russian Twist – 40s ON / 20s OFF</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center mb-2">
            <Zap className="w-5 h-5 text-orange-500 mr-2" />
            <div className="text-lg font-bold text-gray-900">Bloco 3 • 7 minutos</div>
          </div>
          <div className="text-sm text-gray-600 mb-4">Repita 1x</div>
          <ul className="space-y-2 text-gray-700">
            <li>Sprint estacionário explosivo – 1 min</li>
            <li>Burpee com salto – 1 min</li>
            <li>Prancha isométrica – 1 min</li>
            <li>Abdominal reto lento – 1 min</li>
            <li>Prancha lateral – 1 min cada lado</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="text-lg font-bold text-gray-900 mb-2">Desaceleração • 3 minutos</div>
          <ul className="space-y-2 text-gray-700">
            <li>Respiração profunda – 1 min</li>
            <li>Alongamento de abdômen – 1 min</li>
            <li>Alongamento de pernas e lombar – 1 min</li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-24">
          <div className="text-lg font-bold text-gray-900 mb-2">Dicas para maximizar resultados</div>
          <ul className="space-y-2 text-gray-700">
            <li>Mantenha sempre a intensidade alta nos intervalos ON.</li>
            <li>Hidrate-se bem antes e depois.</li>
            <li>Execute o treino de 3 a 5x por semana.</li>
          </ul>
        </div> */}

        
      </div>
    </div>
  )
}
