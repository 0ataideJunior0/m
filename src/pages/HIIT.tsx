import { ChevronLeft, Flame, Timer, Zap, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

export default function HIIT() {
  const navigate = useNavigate()
  const DEFAULT_URL = 'https://www.youtube.com/watch?v=oEPvWztSfk4'
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [embedReady, setEmbedReady] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('musa_hiit_url')
      setVideoUrl((saved !== null ? saved : DEFAULT_URL) || '')
    } catch {
      setVideoUrl(DEFAULT_URL)
    }
  }, [])

  const meta = useMemo(() => ({
    title: 'HIIT Principal',
    duration: '21:02',
    description: 'Treino HIIT completo com aquecimento e blocos de alta intensidade.'
  }), [])

  const embedUrl = useMemo(() => {
    if (!videoUrl) return ''
    const u = new URL(videoUrl)
    const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v') || ''
    if (!id) return ''
    const base = `https://www.youtube.com/embed/${id}`
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
    return `${base}?${params.toString()}`
  }, [videoUrl])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate('/home')} className="mr-3 p-2 rounded-lg hover:bg-black/5 transition">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <div className="flex items-center">
            <Flame className="w-6 h-6 text-red-500 mr-2" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">HIIT Principal</h1>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-lg font-bold text-gray-900">{meta.title}</div>
              <div className="text-sm text-gray-600">{meta.description}</div>
            </div>
            <div className="flex items-center text-gray-700">
              <Timer className="w-5 h-5 mr-2" />
              <span>{meta.duration}</span>
            </div>
          </div>
          <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="HIIT Principal"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                onLoad={() => { setLoading(false); setEmbedReady(true) }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <p className="font-semibold mb-2">Vídeo não disponível</p>
                  {videoUrl && (
                    <a href={videoUrl} target="_blank" rel="noopener" className="underline">Abrir no YouTube</a>
                  )}
                </div>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin"></div>
              </div>
            )}
          </div>
         {/*  <div className="mt-3 flex items-center gap-2">
            <a href={videoUrl || '#'} target="_blank" rel="noopener" className="ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg">Assistir no YouTube</a>
            <button
              onClick={() => {
                try { localStorage.setItem('musa_hiit_url', '') } catch {}
                setVideoUrl('')
                setLoading(false)
                setEmbedReady(false)
              }}
              className="ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg"
            >
              {' ${__web_page_1__.unlinkText} '}
            </button>
            {!embedReady && !videoUrl && (
              <button
                onClick={() => {
                  try { localStorage.setItem('musa_hiit_url', DEFAULT_URL) } catch {}
                  setVideoUrl(DEFAULT_URL)
                  setLoading(true)
                }}
                className="ui-hover bg-white border border-gray-300 text-gray-900 px-4 py-2 rounded-lg"
              >
                Restaurar link padrão
              </button>
            )}
          </div> */}
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
