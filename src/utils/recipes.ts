import { supabase } from '../lib/supabase'
import { Recipe } from '../types'

const BUCKET = 'recipe-images'

/** Receitas publicadas, na ordem que a admin definiu. A RLS já barra quem não é assinante. */
export const listRecipes = async (): Promise<Recipe[]> => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return (data || []) as Recipe[]
  } catch (error) {
    console.error('Error fetching recipes:', error)
    return []
  }
}

export const getRecipe = async (id: string): Promise<Recipe | null> => {
  try {
    const { data, error } = await supabase.from('recipes').select('*').eq('id', id).maybeSingle()

    if (error) throw error
    return (data as Recipe | null) ?? null
  } catch (error) {
    console.error('Error fetching recipe:', error)
    return null
  }
}

export const recipeImageUrl = (path: string | null): string | null =>
  path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null
