import type { Exercise } from '../types'

/**
 * Deriva a chave estável de um exercício dentro de um treino.
 *
 * A chave identifica a linha em `user_exercise_progress`, sob o índice
 * único `(user_id, workout_id, exercise_key)`.
 *
 * FORMATO: `<índice>-<g<grupo>->?<slug>`  ex.: `0-agachamento`, `4-gA-bulgaro`
 *
 * ─── Por que o índice entra sempre ───────────────────────────────────
 * A versão anterior derivava a chave só do nome, usando o índice apenas
 * quando o nome era vazio. Dois exercícios homônimos no mesmo treino
 * (ex.: "Prancha" no aquecimento e de novo no core) produziam a mesma
 * chave: marcar um marcava o outro na tela, e o índice único consolidava
 * os dois no servidor — sem nenhum aviso para a usuária.
 *
 * ─── Fragilidade aceita ──────────────────────────────────────────────
 * A chave depende da POSIÇÃO do exercício no array. Editar a lista no
 * painel admin (inserir, remover ou reordenar) desloca os índices e
 * invalida as chaves já salvas — o checklist em andamento daquele treino
 * aparece desmarcado. Custo aceito conscientemente; a solução definitiva
 * é um `id` estável por exercício dentro do JSONB, registrada como A-4 em
 * docs/ACHADOS-EXTRAS.md e declarada fora de escopo.
 *
 * Por isso o `index` precisa ser o índice em `finalOrder` (a lista já
 * reordenada com o aquecimento à frente), e essa ordenação precisa ser
 * determinística entre renders.
 *
 * ─── Compatibilidade ─────────────────────────────────────────────────
 * O formato antigo era o slug puro (`agachamento`). O novo sempre começa
 * com dígito + hífen, então as duas famílias nunca colidem: linhas
 * antigas ficam inertes em vez de apontar para o exercício errado.
 */
export function getExerciseKey(ex: Exercise, index: number): string {
  const slug = (ex.exercise || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const prefix = ex.group ? `g${ex.group}-` : ''

  return `${index}-${prefix}${slug || 'exercicio'}`
}
