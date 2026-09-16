/**
 * Vitrine dos motivos de cancelamento — só o que a tela precisa para
 * renderizar. A lista aceita pelo servidor vive em
 * api/_lib/cancellationReasons.ts; src/__tests__/cancellationReasons.test.ts
 * falha se as duas divergirem.
 */
export type CancellationReason = 'preco' | 'pouco_uso' | 'faltou_recurso' | 'nao_gostei' | 'outro'

export interface CancellationReasonDisplay {
  value: CancellationReason
  label: string
}

export const CANCELLATION_REASONS_DISPLAY: CancellationReasonDisplay[] = [
  { value: 'preco', label: 'O preço' },
  { value: 'pouco_uso', label: 'Não estou usando tanto quanto pensei' },
  { value: 'faltou_recurso', label: 'Senti falta de algum recurso' },
  { value: 'nao_gostei', label: 'Não gostei dos treinos/conteúdo' },
  { value: 'outro', label: 'Outro motivo' },
]

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = Object.fromEntries(
  CANCELLATION_REASONS_DISPLAY.map((r) => [r.value, r.label])
) as Record<CancellationReason, string>
