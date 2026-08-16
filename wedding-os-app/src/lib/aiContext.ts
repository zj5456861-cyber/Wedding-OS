// ============================================================================
// AI Context Service（W5 预留）
// ----------------------------------------------------------------------------
// 未来豆包 AI 助手的统一只读数据入口：
//   - 所有数据经现有 RLS（当前登录用户视角）读取，AI 不直接访问数据库
//   - 只读聚合：不包含任何写操作；未来 AI 的建议必须经用户确认后，
//     再由现有业务接口（tasks/timeline/budgets/expenses）执行
//   - W5 可整体迁移到 Edge Function 中复用本逻辑
// ============================================================================

import { supabase } from './supabase'
import { localDateStr, reminderDateOf } from './dashboard'
import type { Task } from './tasks'
import type { TimelineEvent } from './timeline'

export interface AiContext {
  generatedAt: string
  couple: { id: string; name: string; stage_name: string; created_at: string }
  timeline: {
    total: number
    past: number
    upcoming: number
    upcomingList: { id: string; title: string; event_date: string; reminder?: string }[]
  }
  tasks: {
    total: number
    not_started: number
    in_progress: number
    waiting_decision: number
    done: number
    with_reminder: number
    openWithReminder: { id: string; title: string; reminder_date: string }[]
  }
  budget: {
    categories: { id: string; name: string; budget: number; spent: number; remaining: number }[]
    total: number
    spent: number
    remaining: number
  }
  expenses: {
    recent: {
      id: string
      name: string
      category: string
      amount: number
      currency: string
      rmb_amount: number
      expense_date: string
    }[]
    categoryRatio: { category: string; amount: number; pct: number }[]
  }
}

interface CategoryRow {
  id: string
  name: string
}

interface BudgetRow {
  category_id: string
  amount_cny: number
}

interface ExpenseRow {
  id: string
  name: string
  category_id: string
  amount: number
  currency: string
  rmb_amount: number
  expense_date: string
  created_at: string
}

export async function fetchAiContext(coupleId: string): Promise<AiContext> {
  const [
    coupleRes,
    eventsRes,
    tasksRes,
    budgetsRes,
    expensesRes,
    catsRes,
  ] = await Promise.all([
    supabase.from('couples').select('id,name,stage_name,created_at').eq('id', coupleId).single(),
    supabase
      .from('timeline_events')
      .select('*')
      .eq('couple_id', coupleId)
      .is('deleted_at', null),
    supabase.from('tasks').select('*').eq('couple_id', coupleId).is('deleted_at', null),
    supabase.from('budgets').select('*').eq('couple_id', coupleId),
    supabase.from('expenses').select('*').eq('couple_id', coupleId).is('deleted_at', null),
    supabase.from('budget_categories').select('*').eq('couple_id', coupleId),
  ])

  if (coupleRes.error) throw coupleRes.error
  if (eventsRes.error) throw eventsRes.error
  if (tasksRes.error) throw tasksRes.error
  if (budgetsRes.error) throw budgetsRes.error
  if (expensesRes.error) throw expensesRes.error
  if (catsRes.error) throw catsRes.error

  const couple = coupleRes.data as { id: string; name: string; stage_name: string; created_at: string }
  const events = (eventsRes.data ?? []) as TimelineEvent[]
  const tasks = (tasksRes.data ?? []) as Task[]
  const budgets = (budgetsRes.data ?? []) as BudgetRow[]
  const expenses = (expensesRes.data ?? []) as ExpenseRow[]
  const cats = (catsRes.data ?? []) as CategoryRow[]

  const today = localDateStr(new Date())
  const pastEvents = events.filter((ev) => ev.event_date < today)
  const upcomingEvents = events
    .filter((ev) => ev.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))

  const openStatuses: Task['status'][] = ['not_started', 'in_progress', 'waiting_decision']
  const openWithReminder = tasks
    .filter((t) => openStatuses.includes(t.status) && t.reminder_date)
    .sort((a, b) => (a.reminder_date ?? '').localeCompare(b.reminder_date ?? ''))
    .map((t) => ({ id: t.id, title: t.title, reminder_date: t.reminder_date as string }))

  const nameById = new Map(cats.map((c) => [c.id, c.name]))
  const budgetByCat = new Map(
    budgets.map((b) => [b.category_id, Number(b.amount_cny ?? 0)]),
  )
  const spentByCat = new Map<string, number>()
  let spentTotal = 0
  const recent = [...expenses]
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.created_at.localeCompare(a.created_at))
    .slice(0, 5)

  for (const e of expenses) {
    const rmb = Number(e.rmb_amount ?? 0)
    spentTotal += rmb
    spentByCat.set(e.category_id, (spentByCat.get(e.category_id) ?? 0) + rmb)
  }

  const categoryBudget = [...budgetByCat.keys()]
    .map((cid) => {
      const spent = spentByCat.get(cid) ?? 0
      const budget = budgetByCat.get(cid) ?? 0
      return {
        id: cid,
        name: nameById.get(cid) ?? '未分类',
        budget,
        spent,
        remaining: budget - spent,
      }
    })
    .sort((a, b) => b.budget - a.budget)

  const totalBudget = [...budgetByCat.values()].reduce((s, v) => s + v, 0)
  const ratioRows = [...spentByCat.entries()]
    .map(([cid, amount]) => ({
      category: nameById.get(cid) ?? '未分类',
      amount,
      pct: spentTotal > 0 ? Math.round((amount / spentTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  return {
    generatedAt: new Date().toISOString(),
    couple,
    timeline: {
      total: events.length,
      past: pastEvents.length,
      upcoming: upcomingEvents.length,
      upcomingList: upcomingEvents.slice(0, 10).map((ev) => ({
        id: ev.id,
        title: ev.title,
        event_date: ev.event_date,
        reminder: reminderDateOf(ev) ?? undefined,
      })),
    },
    tasks: {
      total: tasks.length,
      not_started: tasks.filter((t) => t.status === 'not_started').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      waiting_decision: tasks.filter((t) => t.status === 'waiting_decision').length,
      done: tasks.filter((t) => t.status === 'done').length,
      with_reminder: tasks.filter((t) => t.reminder_date).length,
      openWithReminder,
    },
    budget: {
      categories: categoryBudget,
      total: totalBudget,
      spent: spentTotal,
      remaining: totalBudget - spentTotal,
    },
    expenses: {
      recent: recent.map((e) => ({
        id: e.id,
        name: e.name,
        category: nameById.get(e.category_id) ?? '未分类',
        amount: Number(e.amount ?? 0),
        currency: e.currency,
        rmb_amount: Number(e.rmb_amount ?? 0),
        expense_date: e.expense_date,
      })),
      categoryRatio: ratioRows,
    },
  }
}
