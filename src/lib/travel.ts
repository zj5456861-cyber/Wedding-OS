import { supabase } from './supabase'

export interface TravelEvent {
  id: string
  title: string
  event_date: string
  category: string | null
}

export interface TravelTask {
  id: string
  title: string
  category: string | null
  status: string
  due_date: string | null
}

export interface TravelExpense {
  id: string
  name: string
  amount: number
  currency: string
  rmb_amount: number
  expense_date: string
  category_id: string
}

export interface TravelSummary {
  events: TravelEvent[]
  tasks: TravelTask[]
  expenses: TravelExpense[]
}

// 旅行记录聚合：时间节点 + 事项 + 支出（分类含“旅行/婚纱照”）
export async function fetchTravelSummary(coupleId: string): Promise<TravelSummary> {
  const [eventsRes, tasksRes, catsRes, expensesRes] = await Promise.all([
    supabase
      .from('timeline_events')
      .select('id,title,event_date,category')
      .eq('couple_id', coupleId)
      .is('deleted_at', null)
      .in('category', ['旅行', '婚纱照'])
      .order('event_date', { ascending: false })
      .limit(20),
    supabase
      .from('tasks')
      .select('id,title,category,status,due_date')
      .eq('couple_id', coupleId)
      .is('deleted_at', null)
      .in('category', ['旅行', '婚纱照'])
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('budget_categories')
      .select('id,name')
      .eq('couple_id', coupleId)
      .is('deleted_at', null),
    supabase
      .from('expenses')
      .select('id,name,amount,currency,rmb_amount,expense_date,category_id')
      .eq('couple_id', coupleId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false })
      .limit(50),
  ])
  if (eventsRes.error) throw eventsRes.error
  if (tasksRes.error) throw tasksRes.error
  if (catsRes.error) throw catsRes.error
  if (expensesRes.error) throw expensesRes.error

  const catIds = new Set(
    (catsRes.data ?? [])
      .filter((c) => /旅行|婚纱照/.test((c as { name: string }).name))
      .map((c) => (c as { id: string }).id),
  )
  return {
    events: (eventsRes.data ?? []) as TravelEvent[],
    tasks: (tasksRes.data ?? []) as TravelTask[],
    expenses: (expensesRes.data ?? []).filter((e) =>
      catIds.has((e as { category_id: string }).category_id),
    ) as TravelExpense[],
  }
}
