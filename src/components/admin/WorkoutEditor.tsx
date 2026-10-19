import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Dumbbell,
  ExternalLink,
  Plus,
  Trash2,
  Undo2,
  Video,
} from 'lucide-react'
import { Exercise } from '../../types'
import { cn } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import Toast from '../ui/Toast'
import Button from '../ui/Button'
import Input from '../ui/Input'
import FormField from '../ui/FormField'
import Modal from '../ui/Modal'
import PageHeader from '../ui/PageHeader'
import {
  DraftErrors,
  EXERCISE_TYPES,
  EditorItem,
  biSetPosition,
  draftSignature,
  duplicateItem,
  emptyExercise,
  hasErrors,
  insertItemAt,
  isLikelyUrl,
  moveItem,
  newKey,
  toExercises,
  toItems,
  typeLabel,
  updateItem,
  validateDraft,
  volumeSummary,
} from '../../utils/workoutEditor'

export interface WorkoutPayload {
  title: string
  video_url: string
  exercises: Exercise[]
}

export interface EditorNavItem {
  label: string
  to: string
  active: boolean
  /** Dia já tem treino salvo. */
  filled: boolean
}

interface WorkoutEditorProps {
  heading: string
  subtitle: string
  backTo: string
  initial: { title: string; videoUrl: string; exercises: Exercise[] }
  isNew: boolean
  /** Campo de bi-set só faz sentido no catálogo (o treino pessoal não agrupa). */
  showGroup: boolean
  nav?: EditorNavItem[]
  onSave: (payload: WorkoutPayload) => Promise<void>
  onDelete?: () => Promise<void>
  deleteLabel?: string
  deleteDescription?: string
}

const UNDO_MS = 6000
const EMPTY_ERRORS: DraftErrors = { exercises: {} }

export default function WorkoutEditor({
  heading,
  subtitle,
  backTo,
  initial,
  isNew,
  showGroup,
  nav,
  onSave,
  onDelete,
  deleteLabel = 'Remover treino',
  deleteDescription,
}: WorkoutEditorProps) {
  const navigate = useNavigate()
  const { toast, show: showToast, dismiss: dismissToast } = useToast()

  const [title, setTitle] = useState(initial.title)
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl)
  const [items, setItems] = useState<EditorItem[]>(() => toItems(initial.exercises))
  const [savedSignature, setSavedSignature] = useState(() =>
    draftSignature({ title: initial.title, videoUrl: initial.videoUrl, items: toItems(initial.exercises) })
  )
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<DraftErrors>(EMPTY_ERRORS)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const [removed, setRemoved] = useState<{ item: EditorItem; index: number } | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const draft = { title, videoUrl, items }
  const dirty = draftSignature(draft) !== savedSignature
  const allOpen = items.length > 0 && items.every((i) => open.has(i.key))

  // Avisa antes de fechar/recarregar a aba com alterações não salvas.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    if (!focusKey) return
    const el = document.getElementById(`ex-name-${focusKey}`)
    el?.focus()
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    setFocusKey(null)
  }, [focusKey])

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }, [])

  const goTo = (to: string) => {
    if (dirty) setPendingNav(to)
    else navigate(to)
  }

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const clearExerciseError = (key: string) => {
    if (!errors.exercises[key]) return
    const { [key]: _, ...rest } = errors.exercises
    setErrors({ ...errors, exercises: rest })
  }

  const handleChange = (key: string, patch: Partial<Exercise>) => {
    setItems((prev) => updateItem(prev, key, patch))
    if (patch.exercise !== undefined) clearExerciseError(key)
  }

  const handleAdd = () => {
    const item = { key: newKey(), exercise: emptyExercise(showGroup) }
    setItems((prev) => [...prev, item])
    setOpen((prev) => new Set(prev).add(item.key))
    setFocusKey(item.key)
  }

  const handleDuplicate = (key: string) => {
    const result = duplicateItem(items, key)
    setItems(result.items)
    if (result.key) {
      setOpen((prev) => new Set(prev).add(result.key!))
      setFocusKey(result.key)
    }
  }

  const handleRemove = (key: string) => {
    const index = items.findIndex((i) => i.key === key)
    if (index < 0) return
    setRemoved({ item: items[index], index })
    setItems((prev) => prev.filter((i) => i.key !== key))
    clearExerciseError(key)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_MS)
  }

  const handleUndo = () => {
    if (!removed) return
    setItems((prev) => insertItemAt(prev, removed.item, removed.index))
    setOpen((prev) => new Set(prev).add(removed.item.key))
    setRemoved(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }

  const handleSave = useCallback(async () => {
    if (saving) return
    const found = validateDraft(draft)
    setErrors(found)
    if (hasErrors(found)) {
      const firstBad = items.find((i) => found.exercises[i.key])
      if (found.title) {
        document.getElementById('workout-title')?.focus()
      } else if (firstBad) {
        setOpen((prev) => new Set(prev).add(firstBad.key))
        setFocusKey(firstBad.key)
      }
      showToast('Corrija os campos destacados antes de salvar.')
      return
    }

    setSaving(true)
    try {
      await onSave({ title: title.trim(), video_url: videoUrl.trim(), exercises: toExercises(items) })
      setTitle(title.trim())
      setVideoUrl(videoUrl.trim())
      setSavedSignature(draftSignature({ title: title.trim(), videoUrl: videoUrl.trim(), items }))
      showToast(isNew ? 'Treino criado!' : 'Alterações salvas!', 'success')
    } catch (error: any) {
      showToast(`Erro ao salvar treino. ${error?.message || ''}`)
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, title, videoUrl, items, isNew, onSave])

  // Ctrl/Cmd + S salva.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      setTitle('')
      setVideoUrl('')
      setItems([])
      setOpen(new Set())
      setErrors(EMPTY_ERRORS)
      setSavedSignature(draftSignature({ title: '', videoUrl: '', items: [] }))
      setConfirmDelete(false)
      showToast('Treino removido.', 'success')
    } catch (error: any) {
      showToast(`Erro ao remover treino. ${error?.message || ''}`)
    } finally {
      setDeleting(false)
    }
  }

  const statusText = useMemo(() => {
    if (dirty) return isNew ? 'Ainda não salvo' : 'Alterações não salvas'
    return isNew ? 'Treino ainda não criado' : 'Tudo salvo'
  }, [dirty, isNew])

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-40">
        <PageHeader title={heading} onBack={() => goTo(backTo)} className="mb-1" />
        <p className="text-sm text-text-muted ml-[3.25rem] mb-6">{subtitle}</p>

        {nav && (
          <nav aria-label="Dias da semana" className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 mb-6">
            {nav.map((n) => (
              <button
                key={n.to}
                type="button"
                aria-current={n.active ? 'page' : undefined}
                onClick={() => !n.active && goTo(n.to)}
                className={cn(
                  'relative shrink-0 min-h-11 min-w-12 px-3 rounded-full text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-focus-ring',
                  n.active ? 'brand-gradient shadow-md' : 'bg-surface border border-border text-text hover:bg-surface-hover'
                )}
              >
                {n.label}
                {n.filled && !n.active && (
                  <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
                )}
                {!n.filled && <span className="sr-only"> (sem treino)</span>}
              </button>
            ))}
          </nav>
        )}

        <section aria-labelledby="info-heading" className="bg-surface border border-border-card rounded-3xl shadow-sm p-5 mb-6 space-y-4">
          <h2 id="info-heading" className="text-lg font-extrabold tracking-tight text-text-strong">Informações</h2>
          <FormField label="Título" htmlFor="workout-title" error={errors.title}>
            <Input
              id="workout-title"
              type="text"
              value={title}
              error={!!errors.title}
              aria-describedby={errors.title ? 'workout-title-error' : undefined}
              placeholder="Ex.: Inferiores — glúteo e posterior"
              onChange={(e) => {
                setTitle(e.target.value)
                if (errors.title) setErrors({ ...errors, title: undefined })
              }}
            />
          </FormField>
          <FormField label="Vídeo do dia (opcional)" htmlFor="workout-video">
            <Input
              id="workout-video"
              type="url"
              inputMode="url"
              value={videoUrl}
              icon={<Video className="w-5 h-5" />}
              placeholder="https://"
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            {!isLikelyUrl(videoUrl) && (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">Isso não parece um link. Ele deve começar com https://</p>
            )}
          </FormField>
        </section>

        <section aria-labelledby="exercises-heading">
          <div className="flex items-end justify-between mb-3 px-1">
            <h2 id="exercises-heading" className="text-lg font-extrabold tracking-tight text-text-strong">
              Exercícios <span className="text-text-muted font-bold">{items.length}</span>
            </h2>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((i) => i.key)))}
                className="text-sm font-bold text-accent-text hover:opacity-80"
              >
                {allOpen ? 'Recolher todos' : 'Expandir todos'}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="bg-surface border border-dashed border-border rounded-3xl p-8 text-center">
              <Dumbbell aria-hidden="true" className="w-8 h-8 mx-auto text-text-muted mb-2" />
              <p className="font-bold text-text-strong">Nenhum exercício ainda</p>
              <p className="text-sm text-text-muted mb-4">Adicione o primeiro pra montar o treino.</p>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar exercício
              </Button>
            </div>
          ) : (
            <>
              <ol className="flex flex-col gap-2">
                {items.map((item, index) => (
                  <ExerciseCard
                    key={item.key}
                    item={item}
                    index={index}
                    total={items.length}
                    isOpen={open.has(item.key)}
                    error={errors.exercises[item.key]}
                    showGroup={showGroup}
                    biSet={showGroup ? biSetPosition(items, index) : 'none'}
                    onToggle={() => toggle(item.key)}
                    onChange={(patch) => handleChange(item.key, patch)}
                    onMove={(dir) => setItems((prev) => moveItem(prev, item.key, dir))}
                    onDuplicate={() => handleDuplicate(item.key)}
                    onRemove={() => handleRemove(item.key)}
                  />
                ))}
              </ol>
              <button
                type="button"
                onClick={handleAdd}
                className="mt-3 w-full min-h-12 rounded-2xl border-2 border-dashed border-border text-accent-text font-bold hover:bg-accent/5 hover:border-accent/40 transition inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-focus-ring"
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar exercício
              </button>
            </>
          )}
        </section>

        {onDelete && !isNew && (
          <div className="mt-10 pt-6 border-t border-border">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center text-sm font-bold text-red-600 dark:text-red-400 hover:opacity-80"
            >
              <Trash2 className="w-4 h-4 mr-1" /> {deleteLabel}
            </button>
          </div>
        )}
      </div>

      {removed && (
        <div role="status" className="fixed bottom-24 left-4 right-4 z-[55] mx-auto max-w-md flex items-center gap-3 rounded-2xl bg-text-strong text-bg shadow-lg px-4 py-3">
          <p className="flex-1 text-sm font-medium truncate">
            “{removed.item.exercise.exercise.trim() || 'Exercício sem nome'}” removido
          </p>
          <button type="button" onClick={handleUndo} className="inline-flex items-center text-sm font-extrabold hover:opacity-80">
            <Undo2 className="w-4 h-4 mr-1" /> Desfazer
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur border-t border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0 text-sm" aria-live="polite">
            <span className={cn('inline-flex items-center font-bold', dirty ? 'text-amber-700 dark:text-amber-400' : 'text-text-muted')}>
              {dirty ? (
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
              ) : (
                !isNew && <Check aria-hidden="true" className="w-4 h-4 mr-1" />
              )}
              {statusText}
            </span>
            <span className="hidden sm:inline text-text-muted"> · Ctrl+S salva</span>
          </div>
          <Button onClick={handleSave} isLoading={saving} disabled={!dirty && !isNew}>
            {isNew ? 'Criar treino' : 'Salvar alterações'}
          </Button>
        </div>
      </div>

      <Modal
        open={!!pendingNav}
        onClose={() => setPendingNav(null)}
        title="Sair sem salvar?"
        size="card"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPendingNav(null)}>
              Continuar editando
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                const to = pendingNav
                setPendingNav(null)
                if (to) navigate(to)
              }}
            >
              Sair sem salvar
            </Button>
          </div>
        }
      >
        <p className="p-5 text-text">As alterações deste treino ainda não foram salvas e vão se perder.</p>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={deleteLabel}
        size="card"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete} isLoading={deleting}>
              Remover
            </Button>
          </div>
        }
      >
        <p className="p-5 text-text">{deleteDescription || 'Isso não pode ser desfeito.'}</p>
      </Modal>

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}

interface ExerciseCardProps {
  item: EditorItem
  index: number
  total: number
  isOpen: boolean
  error?: string
  showGroup: boolean
  biSet: ReturnType<typeof biSetPosition>
  onToggle: () => void
  onChange: (patch: Partial<Exercise>) => void
  onMove: (direction: -1 | 1) => void
  onDuplicate: () => void
  onRemove: () => void
}

function ExerciseCard({
  item,
  index,
  total,
  isOpen,
  error,
  showGroup,
  biSet,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: ExerciseCardProps) {
  const ex = item.exercise
  const name = ex.exercise.trim()
  const volume = volumeSummary(ex)
  const panelId = `ex-panel-${item.key}`
  const nameLabel = name || `Exercício ${index + 1}`
  const group = ex.group?.trim()

  return (
    <li
      className={cn(
        'bg-surface border rounded-2xl shadow-sm',
        error ? 'border-red-400' : 'border-border-card',
        biSet !== 'none' && 'border-l-4 border-l-accent',
        (biSet === 'start' || biSet === 'middle') && '-mb-1',
      )}
    >
      <div className="flex items-center gap-1 p-2 pl-3">
        <span
          aria-hidden="true"
          className="w-7 h-7 shrink-0 rounded-full bg-accent/15 text-accent-text flex items-center justify-center text-xs font-extrabold"
        >
          {index + 1}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex-1 min-w-0 text-left px-2 py-1.5 rounded-xl hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-focus-ring"
        >
          <span className={cn('block font-bold truncate', name ? 'text-text-strong' : 'text-text-muted italic')}>
            {name || 'Sem nome'}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted mt-0.5">
            {volume && <span>{volume}</span>}
            {ex.type && ex.type !== 'normal' && (
              <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent-text font-bold">{typeLabel(ex.type)}</span>
            )}
            {showGroup && group && (
              <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent-text font-bold">Bi-set {group}</span>
            )}
            {ex.video?.trim() && (
              <span className="inline-flex items-center">
                <Video aria-hidden="true" className="w-3.5 h-3.5 mr-0.5" /> vídeo
              </span>
            )}
            {error && <span className="text-red-600 dark:text-red-400 font-bold">{error}</span>}
          </span>
        </button>
        <IconButton label={`Mover ${nameLabel} para cima`} onClick={() => onMove(-1)} disabled={index === 0}>
          <ArrowUp className="w-4 h-4" />
        </IconButton>
        <IconButton label={`Mover ${nameLabel} para baixo`} onClick={() => onMove(1)} disabled={index === total - 1}>
          <ArrowDown className="w-4 h-4" />
        </IconButton>
        <IconButton label={isOpen ? `Recolher ${nameLabel}` : `Editar ${nameLabel}`} onClick={onToggle}>
          <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        </IconButton>
      </div>

      {isOpen && (
        <div id={panelId} className="px-4 pb-4 pt-2 border-t border-border space-y-4">
          <FormField label="Nome do exercício" htmlFor={`ex-name-${item.key}`} error={error}>
            <Input
              id={`ex-name-${item.key}`}
              type="text"
              placeholder="Nome do exercício"
              value={ex.exercise}
              error={!!error}
              onChange={(e) => onChange({ exercise: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Séries" htmlFor={`ex-sets-${item.key}`}>
              <Input
                id={`ex-sets-${item.key}`}
                type="text"
                inputMode="numeric"
                placeholder="Ex.: 3"
                value={ex.sets || ''}
                onChange={(e) => onChange({ sets: e.target.value })}
              />
            </FormField>
            <FormField label="Repetições" htmlFor={`ex-reps-${item.key}`}>
              <Input
                id={`ex-reps-${item.key}`}
                type="text"
                placeholder="Ex.: 12 a 15"
                value={ex.reps}
                onChange={(e) => onChange({ reps: e.target.value })}
              />
            </FormField>
          </div>

          <div>
            <span id={`ex-type-${item.key}`} className="block text-sm font-medium text-text-muted mb-1">
              Tipo
            </span>
            <div role="radiogroup" aria-labelledby={`ex-type-${item.key}`} className="flex flex-wrap gap-2">
              {EXERCISE_TYPES.map((t) => {
                const selected = (ex.type || 'normal') === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChange({ type: t.value })}
                    className={cn(
                      'min-h-10 px-4 rounded-full text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-focus-ring',
                      selected ? 'brand-gradient shadow-md' : 'bg-surface border border-border text-text hover:bg-surface-hover'
                    )}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {showGroup && (
            <FormField label="Bi-set (opcional)" htmlFor={`ex-group-${item.key}`}>
              <Input
                id={`ex-group-${item.key}`}
                type="text"
                maxLength={3}
                placeholder="Ex.: A"
                value={ex.group || ''}
                aria-describedby={`ex-group-hint-${item.key}`}
                onChange={(e) => onChange({ group: e.target.value.toUpperCase() })}
              />
              <p id={`ex-group-hint-${item.key}`} className="mt-1 text-xs text-text-muted">
                Exercícios seguidos com a mesma letra viram um bi-set.
              </p>
            </FormField>
          )}

          <FormField label="Vídeo do exercício (opcional)" htmlFor={`ex-video-${item.key}`}>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  id={`ex-video-${item.key}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={ex.video || ''}
                  onChange={(e) => onChange({ video: e.target.value })}
                />
              </div>
              {ex.video?.trim() && isLikelyUrl(ex.video) && (
                <a
                  href={ex.video.trim()}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir vídeo em nova aba"
                  className="shrink-0 p-3 rounded-xl border border-border text-text hover:bg-surface-hover"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>
            {!isLikelyUrl(ex.video || '') && (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">Isso não parece um link. Ele deve começar com https://</p>
            )}
          </FormField>

          <FormField label="Observação (opcional)" htmlFor={`ex-note-${item.key}`}>
            <textarea
              id={`ex-note-${item.key}`}
              rows={2}
              placeholder="Ex.: descer devagar, 3 segundos"
              value={ex.note || ''}
              onChange={(e) => onChange({ note: e.target.value })}
              className="w-full px-4 py-3 border border-border rounded-xl outline-none transition bg-surface-sunken text-text placeholder:text-text-placeholder focus:ring-2 focus:ring-focus-ring focus:border-transparent resize-y"
            />
          </FormField>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onDuplicate}>
              <Copy className="w-4 h-4 mr-1.5" /> Duplicar
            </Button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 focus:outline-none focus:ring-2 focus:ring-focus-ring"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Remover
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-full text-text-muted hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-focus-ring"
    >
      {children}
    </button>
  )
}
