import { supabase } from './supabase'
import type { TimelineEvent } from './timeline'
import type { Task } from './tasks'

export interface ActivityLog {
  id: number
  couple_id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: Record<string, unknown> | null
  created_at: string
  actorDisplayName?: string
}

// 提醒日期计算：event_date - reminder_days_before（纯日期运算，避免时区偏移）
export function reminderDateOf(ev: TimelineEvent): string | null {
  if (ev.reminder_days_before == null) return null
  const [y, m, d] = ev.event_date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - ev.reminder_days_before))
  return dt.toISOString().slice(0, 10)
}

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

// 事项提醒：仅 未开始/进行中，提醒日期落在 [from, to]
export async function fetchTaskReminders(
  coupleId: string,
  from: string,
  to: string,
): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .in('status', ['not_started', 'in_progress'])
    .not('reminder_date', 'is', null)
    .gte('reminder_date', from)
    .lte('reminder_date', to)
    .order('reminder_date', { ascending: true })
    .limit(20)
  if (error) throw error
  return (data ?? []) as Task[]
}

// 时间节点提醒：按 event_date - reminder_days_before 计算提醒日，落在 [from, to]
export async function fetchEventReminders(
  coupleId: string,
  from: string,
  to: string,
): Promise<TimelineEvent[]> {
  const horizon = shiftDate(from, -120)
  const { data, error } = await supabase
    .from('timeline_events')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .not('reminder_days_before', 'is', null)
    .gte('event_date', horizon)
    .order('event_date', { ascending: true })
    .limit(50)
  if (error) throw error
  const rows = (data ?? []) as TimelineEvent[]
  return rows.filter((ev) => {
    const remind = reminderDateOf(ev)
    return Boolean(remind && remind >= from && remind <= to)
  })
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export async function fetchUpcomingEvents(
  coupleId: string,
  limit = 3,
): Promise<TimelineEvent[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('timeline_events')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as TimelineEvent[]
}

// 婚礼节点（倒计时用）：分类为“婚礼”的未来最近节点
export async function fetchWeddingEvent(
  coupleId: string,
): Promise<TimelineEvent | null> {
  const today = localDateStr(new Date())
  const { data, error } = await supabase
    .from('timeline_events')
    .select('id,title,event_date')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .eq('category', '婚礼')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
  if (error) throw error
  return ((data ?? []) as TimelineEvent[])[0] ?? null
}

export interface MomentParts {
  days: number
  months: number
  remainingDays: number
}

// 重要时刻倒计时：按天 / 按月+天（月按 30 天近似，简单稳定）
export function momentParts(
  target: string,
  from = localDateStr(new Date()),
): MomentParts {
  const [ty, tm, td] = target.split('-').map(Number)
  const [fy, fm, fd] = from.split('-').map(Number)
  const days = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000,
  )
  const months = Math.floor(days / 30)
  const remainingDays = days % 30
  return { days, months, remainingDays }
}

// 未完成事项数量（首页当前阶段模块展示）
export async function fetchOpenTaskCount(coupleId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .neq('status', 'done')
  if (error) throw error
  return count ?? 0
}

export async function fetchRecentTasks(coupleId: string, limit = 5): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Task[]
}

export async function fetchBudgetOverview(
  coupleId: string,
): Promise<{ budgetTotal: number; spentTotal: number }> {
  const [
    { data: cats, error: err0 },
    { data: budgets, error: err1 },
    { data: expenses, error: err2 },
  ] = await Promise.all([
    supabase
      .from('budget_categories')
      .select('id,parent_id')
      .eq('couple_id', coupleId)
      .is('deleted_at', null),
    supabase.from('budgets').select('amount_cny,category_id').eq('couple_id', coupleId),
    supabase
      .from('expenses')
      .select('rmb_amount')
      .eq('couple_id', coupleId)
      .is('deleted_at', null),
  ])
  if (err0) throw err0
  if (err1) throw err1
  if (err2) throw err2
  // 总预算 = 所有可见一级分类预算之和（排除已删除分类的残留预算行）
  const activeTopIds = new Set(
    (cats ?? [])
      .filter((c) => !(c as { parent_id?: string | null }).parent_id)
      .map((c) => (c as { id: string }).id),
  )
  const budgetTotal = (budgets ?? [])
    .filter((b) => activeTopIds.has((b as { category_id: string }).category_id))
    .reduce(
    (sum, b) => sum + Number((b as { amount_cny?: number | string }).amount_cny ?? 0),
    0,
    )
  const spentTotal = (expenses ?? []).reduce(
    (sum, e) => sum + Number((e as { rmb_amount?: number | string }).rmb_amount ?? 0),
    0,
  )
  return { budgetTotal, spentTotal }
}

export async function fetchRecentLogs(coupleId: string, limit = 10): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const logs = (data ?? []) as ActivityLog[]
  const ids = [...new Set(logs.map((l) => l.actor_id).filter((v): v is string => Boolean(v)))]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const { data: profiles, error: perr } = await supabase
      .from('profiles')
      .select('id,display_name')
      .in('id', ids)
    if (!perr) {
      for (const p of profiles ?? []) {
        const row = p as { id: string; display_name?: string | null }
        const name = row.display_name?.trim()
        if (name) names.set(row.id, name)
      }
    }
  }
  return logs.map((l) => ({
    ...l,
    actorDisplayName: l.actor_id ? names.get(l.actor_id) : undefined,
  }))
}
