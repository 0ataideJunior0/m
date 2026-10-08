import { Check, Play } from 'lucide-react'

export type WorkoutSessionStatus = 'idle' | 'active' | 'blocked'

interface WorkoutActionBarProps {
  /** idle: ainda não iniciado · active: este treino está em andamento · blocked: outro treino está em andamento */
  status: WorkoutSessionStatus
  onStart: () => void
  onComplete: () => void
  completing: boolean
  /** Título do treino em andamento, quando é outro. */
  blockedTitle?: string
  onGoToActive?: () => void
}

const primaryClass =
  'w-full brand-gradient py-4 px-6 rounded-full shadow-cta hover:shadow-cta-hover hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-lg flex items-center justify-center'

export default function WorkoutActionBar({
  status,
  onStart,
  onComplete,
  completing,
  blockedTitle,
  onGoToActive,
}: WorkoutActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4">
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        {status === 'blocked' && (
          <p role="status" className="text-sm text-text-muted text-center">
            Você já está treinando <strong className="text-text-strong">{blockedTitle}</strong>. Conclua esse treino
            para iniciar outro.{' '}
            {onGoToActive && (
              <button type="button" onClick={onGoToActive} className="font-bold text-accent-text hover:opacity-80 underline">
                Voltar para ele
              </button>
            )}
          </p>
        )}

        {status === 'active' ? (
          <button onClick={onComplete} disabled={completing} className={primaryClass}>
            {completing ? (
              'Marcando...'
            ) : (
              <>
                <Check className="w-5 h-5 mr-2" />
                Marcar como Concluído
              </>
            )}
          </button>
        ) : (
          <button onClick={onStart} disabled={status === 'blocked'} className={primaryClass}>
            <Play className="w-5 h-5 mr-2" />
            Iniciar treino
          </button>
        )}
      </div>
    </div>
  )
}
