import { supabase } from './supabase'

export type TaskStatus = 'not_started' | 'in_progress' | 'waiting_decision' | 'done'

export interface Task {
  id: string
  couple_id: string
  title: string
  category: string | null
  sort_order: number
  status: TaskStatus
  due_date: string | null
  reminder_date: string | null
  note: string | null
  completed_at: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export interface TaskInput {
  title: string
  category: string | null
  status: TaskStatus
  due_date: string | null
  reminder_date: string | null
  note: string | null
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  waiting_decision: '待线下决定',
  done: '已完成',
}

export async function fetchTasks(coupleId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Task[]
}

export async function createTask(coupleId: string, input: TaskInput): Promise<void> {
  const category = input.category?.trim() || null
  const countQuery = category
    ? supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId)
        .eq('category', category)
        .is('deleted_at', null)
    : supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('couple_id', coupleId)
        .is('category', null)
        .is('deleted_at', null)
  const { count, error: countError } = await countQuery
  if (countError) throw countError

  const { error } = await supabase.from('tasks').insert({
    couple_id: coupleId,
    title: input.title.trim(),
    category,
    sort_order: count ?? 0,
    status: input.status,
    due_date: input.due_date || null,
    reminder_date: input.reminder_date || null,
    note: input.note?.trim() || null,
    completed_at: input.status === 'done' ? new Date().toISOString() : null,
  })
  if (error) throw error
}

// 分类内排序：按传入 id 顺序写入 sort_order（0..n-1）
export async function reorderTasks(
  coupleId: string,
  orderedIds: string[],
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('tasks')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('couple_id', coupleId),
    ),
  )
}

export async function updateTask(id: string, input: TaskInput): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      title: input.title.trim(),
      category: input.category?.trim() || null,
      status: input.status,
      due_date: input.due_date || null,
      reminder_date: input.reminder_date || null,
      note: input.note?.trim() || null,
      completed_at: input.status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// 删除某分类下的全部事项（软删，与分类删除联动）
export async function deleteTasksByCategory(
  coupleId: string,
  categoryName: string,
): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('couple_id', coupleId)
    .eq('category', categoryName)
    .is('deleted_at', null)
  if (error) throw error
}
