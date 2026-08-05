import { ChevronLeft, Flame, Timer, Zap, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

export default function HIIT() {
  const navigate = useNavigate()
  const DEFAULT_URL = 'https://www.youtube.com/watch?v=oEPvWztSfk4'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Limpeza one-shot de um resíduo: uma UI já removida gravava aqui,
    // inclusive '' ao "desvincular" o vídeo. Como essa página nunca
    // ofereceu (e nunca vai oferecer) forma de reconfigurar isso, a leitura
    // condicionada a essa chave deixava a tela permanentemente sem vídeo
    // pra quem tinha o resíduo — sem nenhum caminho de recuperação pela
    // interface. Editar o vídeo de HIIT é responsabilidade da tabela
    // `workouts`, não do localStorage de cada dispositivo.
    try { localStorage.removeItem('musa_hiit_url') } catch {}
  }, [])

  const meta = useMemo(() => ({
    title: 'HIIT Principal',
    duration: '21:02',
    description: 'Treino HIIT completo com aquecimento e blocos de alta intensidade.'
  }), [])

  const embedUrl = useMemo(() => {
    const u = new URL(DEFAULT_URL)
    const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v') || ''
    if (!id) return ''
    const base = `https://www.youtube.com/embed/${id}`
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' })
    return `${base}?${params.toString()}`
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate('/home')} className="mr-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition">
            <ChevronLeft className="w-6 h-6 text-text" />
          </button>
          <div className="flex items-center">
            <Flame className="w-6 h-6 text-red-500 mr-2" />
            <h1 className="text-2xl md:text-3xl font-bold text-text">HIIT Principal</h1>
          </div>
        </div>
        <div className="bg-surface rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-lg font-bold text-text">{meta.title}</div>
              <div className="text-sm text-text-muted">{meta.description}</div>
            </div>
            <div className="flex items-center text-text-muted">
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
                onLoad={() => setLoading(false)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <p className="font-semibold mb-2">Vídeo não disponível</p>
                  <a href={DEFAULT_URL} target="_blank" rel="noopener" className="underline">Abrir no YouTube</a>
                </div>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-pink-200 border-t-purple-600 animate-spin"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
