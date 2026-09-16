/**
 * Fonte de verdade dos motivos de cancelamento aceitos pelo servidor.
 * src/utils/cancellationReasons.ts guarda os rótulos exibidos na tela; um
 * teste (src/__tests__/cancellationReasons.test.ts) garante que os dois não
 * divirjam em silêncio.
 */
export type CancellationReason = 'preco' | 'pouco_uso' | 'faltou_recurso' | 'nao_gostei' | 'outro'

export const CANCELLATION_REASONS: CancellationReason[] = [
  'preco',
  'pouco_uso',
  'faltou_recurso',
  'nao_gostei',
  'outro',
]

export const isCancellationReason = (value: unknown): value is CancellationReason =>
  typeof value === 'string' && (CANCELLATION_REASONS as string[]).includes(value)
