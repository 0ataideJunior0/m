import { RefObject } from 'react'
import { X } from 'lucide-react'

interface ExerciseVideoModalProps {
  open: boolean
  videoUrl: string | null
  videoTitle: string
  videoLoading: boolean
  onVideoLoaded: () => void
  onClose: () => void
  dialogRef: RefObject<HTMLDivElement>
}

export default function ExerciseVideoModal({
  open,
  videoUrl,
  videoTitle,
  videoLoading,
  onVideoLoaded,
  onClose,
  dialogRef,
}: ExerciseVideoModalProps) {
  if (!open || !videoUrl) return null

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm flex flex-col">
      <div className="bg-surface/95 p-3 flex items-center justify-between">
        <div className="font-semibold text-text-strong">{videoTitle || 'Vídeo do exercício'}</div>
        <button
          onClick={onClose}
          className="ui-hover bg-surface border border-border text-text px-3 py-2 rounded-md flex items-center"
          aria-label="Fechar"
        >
          <X className="w-4 h-4 mr-1" />
          Fechar
        </button>
      </div>
      <div className="flex-1 bg-black relative">
        {videoLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-border-card border-t-accent animate-spin"></div>
          </div>
        )}
        {/youtube\.com|youtu\.be|vimeo\.com/.test(videoUrl) ? (
          <iframe
            src={videoUrl}
            title="Vídeo do exercício"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            onLoad={onVideoLoaded}
          />
        ) : (
          <video controls className="w-full h-full" onCanPlay={onVideoLoaded}>
            <source src={videoUrl} />
          </video>
        )}
      </div>
    </div>
  )
}
