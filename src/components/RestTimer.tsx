import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '../lib/utils'

const DEFAULT_SECONDS = 90
const FINISHED_FLASH_MS = 1000

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function RestTimer() {
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SECONDS)
  const [running, setRunning] = useState(false)
  const [justFinished, setJustFinished] = useState(false)

  const runningRef = useRef(running)
  runningRef.current = running

  // Um único intervalo por segundo conduz a contagem; ao chegar em zero ele
  // para sozinho, vibra e agenda a volta ao estado parado após o flash.
  useEffect(() => {
    if (!running) return

    const interval = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false)
          setJustFinished(true)
          navigator.vibrate?.(400)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (!justFinished) return
    const timeout = setTimeout(() => {
      setJustFinished(false)
      setSecondsLeft(DEFAULT_SECONDS)
    }, FINISHED_FLASH_MS)
    return () => clearTimeout(timeout)
  }, [justFinished])

  const handleClick = () => {
    // Reinicia sempre — tanto parado quanto durante a contagem, tocar de
    // novo significa "começar a descansar agora", não pausar.
    setJustFinished(false)
    setSecondsLeft(DEFAULT_SECONDS)
    setRunning(true)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Iniciar descanso"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500',
        justFinished
          ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40'
          : 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40'
      )}
    >
      <Clock className="w-4 h-4" />
      {formatTime(secondsLeft)}
    </button>
  )
}
