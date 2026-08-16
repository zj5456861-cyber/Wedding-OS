import { supabase } from './supabase'

export interface TaskCategory {
  id: string
  couple_id: string
  name: string
  sort_order: number
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export async function fetchTaskCategories(coupleId: string): Promise<TaskCategory[]> {
  const { data, error } = await supabase
    .from('task_categories')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TaskCategory[]
}

export async function createTaskCategory(coupleId: string, name: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('task_categories')
    .select('id', { count: 'exact', head: true })
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
  if (countError) throw countError
  const { error } = await supabase.from('task_categories').insert({
    couple_id: coupleId,
    name: name.trim(),
    sort_order: count ?? 0,
  })
  if (error) throw error
}

// 改名：同步分类名与其下所有事项的 category 文本
export async function renameTaskCategory(
  coupleId: string,
  id: string,
  newName: string,
): Promise<void> {
  const { data: old, error: fetchError } = await supabase
    .from('task_categories')
    .select('name')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  const oldName = (old as { name: string }).name
  const trimmed = newName.trim()
  if (!trimmed || trimmed === oldName) return

  const { error: updateError } = await supabase
    .from('task_categories')
    .update({ name: trimmed })
    .eq('id', id)
  if (updateError) throw updateError

  const { error: taskError } = await supabase
    .from('tasks')
    .update({ category: trimmed })
    .eq('couple_id', coupleId)
    .eq('category', oldName)
  if (taskError) throw taskError
}

export async function deleteTaskCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('task_categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// 分类排序：按传入 id 顺序写入 sort_order（0..n-1）
export async function reorderTaskCategories(
  coupleId: string,
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('task_categories')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('couple_id', coupleId),
    ),
  )
}
