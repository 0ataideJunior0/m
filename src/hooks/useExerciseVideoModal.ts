import { useEffect, useRef, useState } from 'react'
import { Exercise, Workout } from '../types'
import { useDialogA11y } from './useDialogA11y'
import { useToast } from './useToast'
import { resolveVideoUrl } from '../utils/videoUrl'

/** Modal de "ver execução" por exercício (YouTube/Vimeo/arquivo direto), com
 *  prefetch do primeiro vídeo do treino. Compartilhado entre WorkoutDay e
 *  MyWorkout — cada tela só precisa passar o `workout` carregado. */
export function useExerciseVideoModal(workout: Workout | null) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [videoLoading, setVideoLoading] = useState(false)
  const videoCache = useState<Map<string, string>>(() => new Map())[0]
  const { toast, show: showToast, dismiss: dismissToast } = useToast()
  const videoDialogRef = useRef<HTMLDivElement>(null)

  const closeVideoModal = () => { setModalOpen(false); setVideoLoading(false) }
  useDialogA11y(modalOpen && !!videoUrl, closeVideoModal, videoDialogRef)

  useEffect(() => {
    if (workout?.exercises?.[0]?.video) {
      const url = resolveVideoUrl(workout.exercises[0].video)
      videoCache.set(workout.exercises[0].exercise, url)
    }
  }, [workout])

  const openExerciseVideo = (exercise: Exercise) => {
    const ownVideo = (exercise as any).video || (exercise as any).video_url || (exercise as any).videoUrl || (exercise as any).url_video || ''
    const title = ownVideo ? exercise.exercise : 'Vídeo do treino'
    setVideoTitle(title)
    const raw = ownVideo || workout?.video_url || ''
    if (!raw) {
      showToast('Vídeo não disponível para este exercício.')
      return
    }
    const cached = videoCache.get(title)
    const url = cached || resolveVideoUrl(raw)
    if (!cached) videoCache.set(title, url)
    setVideoUrl(url)
    setModalOpen(true)
    setVideoLoading(true)
  }

  return {
    videoUrl,
    videoTitle,
    modalOpen,
    videoLoading,
    videoDialogRef,
    toast,
    dismissToast,
    openExerciseVideo,
    closeVideoModal,
    onVideoLoaded: () => setVideoLoading(false),
  }
}
