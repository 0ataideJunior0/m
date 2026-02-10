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

        

        
      </div>
    </div>
  )
}
