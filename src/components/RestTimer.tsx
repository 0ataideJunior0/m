import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import Modal from './ui/Modal'

const DEFAULT_SECONDS = 90
const FINISHED_FLASH_MS = 1000

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function RestTimer() {
  const [open, setOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS)
  const [running, setRunning] = useState(false)

  // A contagem só existe enquanto o modal está aberto e rodando; fechar (de
  // qualquer jeito) ou zerar interrompe o intervalo.
  useEffect(() => {
    if (!open || !running) return

    const interval = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false)
          navigator.vibrate?.(400)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open, running])

  // Ao zerar, dá um instante pra pessoa ver "0:00" antes de fechar sozinho.
  useEffect(() => {
    if (open && !running && secondsLeft === 0) {
      const timeout = setTimeout(() => setOpen(false), FINISHED_FLASH_MS)
      return () => clearTimeout(timeout)
    }
  }, [open, running, secondsLeft])

  const handleOpen = () => {
    setSecondsLeft(DEFAULT_SECONDS)
    setRunning(true)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setRunning(false)
    setSecondsLeft(DEFAULT_SECONDS)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md text-accent-text hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-focus-ring"
      >
        <Clock className="w-4 h-4" />
        Descanso
      </button>
      <Modal open={open} onClose={handleClose} title="Descanso entre séries" size="card">
        <div className="flex flex-col items-center justify-center gap-2 p-8">
          <span
            className={`text-6xl font-bold tabular-nums ${
              secondsLeft === 0 ? 'text-success' : 'text-text-strong'
            }`}
          >
            {formatTime(secondsLeft)}
          </span>
          <p className="text-text-muted text-sm">
            {secondsLeft === 0 ? 'Pode voltar!' : 'Aproveite pra respirar'}
          </p>
        </div>
      </Modal>
    </>
  )
}
