import { supabase } from './supabase'

export interface BudgetCategory {
  id: string
  couple_id: string
  name: string
  parent_id?: string | null
  sort_order: number
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export async function fetchBudgetCategories(coupleId: string): Promise<BudgetCategory[]> {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as BudgetCategory[]
}

export async function createBudgetCategory(
  coupleId: string,
  name: string,
  parentId?: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from('budget_categories')
    .insert({
      couple_id: coupleId,
      name: name.trim(),
      parent_id: parentId || null,
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function renameBudgetCategory(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('budget_categories')
    .update({ name: name.trim() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteBudgetCategory(
  id: string,
  parentId?: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  if (parentId) {
    // 子项目：先把支出归入父分类（数据不丢失），再软删自身
    const { error: moveError } = await supabase
      .from('expenses')
      .update({ category_id: parentId })
      .eq('category_id', id)
    if (moveError) throw moveError
    const { error } = await supabase
      .from('budget_categories')
      .update({ deleted_at: now })
      .eq('id', id)
    if (error) throw error
    return
  }
  // 顶层：软删自身与全部子项目（历史支出保留，名称映射仍可读）
  const { error: childError } = await supabase
    .from('budget_categories')
    .update({ deleted_at: now })
    .eq('parent_id', id)
  if (childError) throw childError
  const { error } = await supabase
    .from('budget_categories')
    .update({ deleted_at: now })
    .eq('id', id)
  if (error) throw error
}
