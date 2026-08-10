import { supabase } from '../lib/supabase'

export type PlanType = 'mass_gain' | 'fat_loss'

export interface MealPlan {
  type: PlanType
  title: string
  description: string | null
  content_md: string
  updated_at: string
}

export const getMealPlan = async (type: PlanType): Promise<MealPlan | null> => {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('type', type)
    .single()

  if (error || !data) return null
  return data as MealPlan
}
