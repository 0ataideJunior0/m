import { Recipe } from '../types'

type Macros = Pick<Recipe, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>

/** "320 kcal · P 28g · C 30g · G 9g" — o que estiver vazio não aparece (zero aparece). */
export const macroSummary = (r: Macros): string => {
  const parts: string[] = []
  if (r.calories !== null) parts.push(`${r.calories} kcal`)
  if (r.protein_g !== null) parts.push(`P ${r.protein_g}g`)
  if (r.carbs_g !== null) parts.push(`C ${r.carbs_g}g`)
  if (r.fat_g !== null) parts.push(`G ${r.fat_g}g`)
  return parts.join(' · ')
}

/** Texto de um item por linha → lista, sem linhas em branco. */
export const splitLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

/** Cabe em `max` de largura mantendo a proporção; nunca aumenta. */
export const fitWithin = (width: number, height: number, max: number): { width: number; height: number } => {
  if (width <= max) return { width, height }
  return { width: max, height: Math.round((height * max) / width) }
}
