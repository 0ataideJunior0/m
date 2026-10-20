import { supabase } from '../lib/supabase'
import { Recipe } from '../types'

const BUCKET = 'recipe-images'

export type RecipePayload = Omit<Recipe, 'id' | 'sort_order' | 'created_at' | 'updated_at'>

export const listRecipesAdmin = async (): Promise<Recipe[]> => {
  const { data, error } = await supabase.from('recipes').select('*').order('sort_order', { ascending: true })

  if (error) throw error
  return (data || []) as Recipe[]
}

export const getRecipeAdmin = async (id: string): Promise<Recipe | null> => {
  const { data, error } = await supabase.from('recipes').select('*').eq('id', id).maybeSingle()

  if (error) throw error
  return (data as Recipe | null) ?? null
}

/** A nova receita entra no fim da lista. */
export const createRecipeAdmin = async (payload: RecipePayload): Promise<Recipe> => {
  const { data: last, error: lastError } = await supabase
    .from('recipes')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) throw lastError

  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...payload, sort_order: last ? last.sort_order + 1 : 0 })
    .select()
    .single()

  if (error) throw error
  return data as Recipe
}

export const updateRecipeAdmin = async (id: string, payload: RecipePayload): Promise<Recipe> => {
  const { data, error } = await supabase
    .from('recipes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Recipe
}

/** Apaga a receita e depois a foto; falha ao apagar a foto só deixa um arquivo órfão, não desfaz nada. */
export const deleteRecipeAdmin = async (recipe: Recipe): Promise<void> => {
  const { error } = await supabase.from('recipes').delete().eq('id', recipe.id)
  if (error) throw error

  if (recipe.image_path) {
    try {
      await removeRecipeImage(recipe.image_path)
    } catch (e) {
      console.error('Recipe deleted but its image could not be removed:', e)
    }
  }
}

export const swapRecipeOrderAdmin = async (a: Recipe, b: Recipe): Promise<void> => {
  const first = await supabase.from('recipes').update({ sort_order: b.sort_order }).eq('id', a.id)
  if (first.error) throw first.error

  const second = await supabase.from('recipes').update({ sort_order: a.sort_order }).eq('id', b.id)
  if (second.error) throw second.error
}

/** Sobe a foto (já reduzida, em WebP) e devolve o caminho no bucket. */
export const uploadRecipeImage = async (file: Blob): Promise<string> => {
  const path = `recipes/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'image/webp' })

  if (error) throw error
  return path
}

export const removeRecipeImage = async (path: string): Promise<void> => {
  const { error } = await supabase.storage.from(BUCKET).remove([path])

  if (error) throw error
}
