// ============================================================================
// Wedding OS · AI 婚前提醒助手 Edge Function
// 前端 -> 本函数 -> 豆包 API -> 返回结构化结果
// ----------------------------------------------------------------------------
// 安全边界：
//   - API Key 只存在于环境变量（DOUBAO_API_KEY），绝不进入前端
//   - AI 不直接访问数据库：仅通过本函数内的 Context Service（RLS 用户视角）聚合
//   - 本函数只读：不写入 tasks / 其他业务表；事项草稿由前端经用户确认后写入
//   - 私人数据隔离：AI 历史仅属当前用户（RLS 保证），系统提示词声明不泄露
// 速度优化（W5.2）：
//   - 按 action 拆分上下文（chat 只带最小必要数据）
//   - 基础信息（空间名/成员/阶段）进程内缓存 5 分钟
//   - max_tokens=700 / temperature=0.4，30 秒超时
//   - 预留流式输出结构（stream 接口暂未启用）
// 部署：
//   supabase functions deploy ai-assistant
//   supabase secrets set DOUBAO_API_KEY=xxx DOUBAO_MODEL=xxx
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const DOUBAO_API_KEY = Deno.env.get('DOUBAO_API_KEY') ?? ''
const DOUBAO_MODEL = Deno.env.get('DOUBAO_MODEL') ?? 'doubao-seed-1-6-250615'
const MAX_TOKENS = Number(Deno.env.get('DOUBAO_MAX_TOKENS') ?? 700)
const TEMPERATURE = Number(Deno.env.get('DOUBAO_TEMPERATURE') ?? 0.4)
const REQUEST_TIMEOUT_MS = 30000
const BASE_CACHE_TTL_MS = 5 * 60 * 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AiAction =
  | 'summary'
  | 'next_steps'
  | 'plan_tasks'
  | 'risk'
  | 'period_summary'
  | 'chat'

interface BaseInfo {
  couple: { name: string; stage_name: string }
  members: string[]
}

interface AiContext {
  couple: { name: string; stage_name: string }
  members: string[]
  timeline?: {
    total: number
    past: number
    upcoming: { title: string; event_date: string; daysLeft: number }[]
  }
  tasks?: {
    counts: { not_started: number; in_progress: number; waiting_decision: number; done: number }
    open: { title: string; status: string; reminder_date?: string; due_date?: string }[]
  }
  budget?: {
    total: number
    spent: number
    remaining: number
    categories: { name: string; budget: number; spent: number; remaining: number }[]
  }
  expenses?: {
    recent: { name: string; category: string; amount: number; currency: string; rmb_amount: number; expense_date: string }[]
    categoryRatio: { category: string; amount: number; pct: number }[]
  }
  myHistory?: { prompt: string; answer: string; type: string }[]
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86400000,
  )
}

// ---------------------------------------------------------------------------
// Context Service（只读，RLS 用户视角）
// ---------------------------------------------------------------------------
const baseCache = new Map<string, { exp: number; data: BaseInfo }>()

async function getBaseInfo(
  client: ReturnType<typeof createClient>,
  coupleId: string,
): Promise<BaseInfo> {
  const hit = baseCache.get(coupleId)
  if (hit && hit.exp > Date.now()) return hit.data

  const [coupleRes, membersRes] = await Promise.all([
    client.from('couples').select('name,stage_name').eq('id', coupleId).single(),
    client.from('couple_members').select('user_id').eq('couple_id', coupleId),
  ])
  if (coupleRes.error) throw new Error(coupleRes.error.message)
  if (membersRes.error) throw new Error(membersRes.error.message)

  const memberIds = ((membersRes.data ?? []) as { user_id: string }[]).map((m) => m.user_id)
  let memberNames: string[] = []
  if (memberIds.length > 0) {
    const { data: profiles, error: pErr } = await client
      .from('profiles')
      .select('display_name')
      .in('id', memberIds)
    if (!pErr) {
      memberNames = (profiles ?? [])
        .map((p) => (p as { display_name?: string }).display_name?.trim())
        .filter((n): n is string => Boolean(n))
    }
  }
  const data: BaseInfo = {
    couple: coupleRes.data as { name: string; stage_name: string },
    members: memberNames,
  }
  baseCache.set(coupleId, { exp: Date.now() + BASE_CACHE_TTL_MS, data })
  return data
}

async function getMyHistory(
  client: ReturnType<typeof createClient>,
  userId: string,
  limit = 8,
): Promise<AiContext['myHistory']> {
  const { data, error } = await client
    .from('ai_suggestions')
    .select('user_prompt,content,suggestion_type')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return ((data ?? []) as { user_prompt: string | null; content: string; suggestion_type: string }[])
    .map((s) => ({
      prompt: s.user_prompt ?? '',
      answer: (s.content ?? '').slice(0, 150),
      type: s.suggestion_type,
    }))
    .reverse()
}

async function getTimeline(client: ReturnType<typeof createClient>, coupleId: string) {
  const today = todayStr()
  const { data, error } = await client
    .from('timeline_events')
    .select('title,event_date')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { title: string; event_date: string }[]
  return {
    total: rows.length,
    past: rows.filter((e) => e.event_date < today).length,
    upcoming: rows
      .filter((e) => e.event_date >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 8)
      .map((e) => ({ title: e.title, event_date: e.event_date, daysLeft: daysBetween(today, e.event_date) })),
  }
}

async function getTasks(client: ReturnType<typeof createClient>, coupleId: string, openLimit = 10) {
  const { data, error } = await client
    .from('tasks')
    .select('title,status,reminder_date,due_date')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as {
    title: string
    status: string
    reminder_date: string | null
    due_date: string | null
  }[]
  const count = (s: string) => rows.filter((t) => t.status === s).length
  const open = rows
    .filter((t) => ['not_started', 'in_progress', 'waiting_decision'].includes(t.status))
    .sort((a, b) => (a.reminder_date ?? a.due_date ?? '').localeCompare(b.reminder_date ?? b.due_date ?? ''))
    .slice(0, openLimit)
    .map((t) => ({
      title: t.title,
      status: t.status,
      reminder_date: t.reminder_date ?? undefined,
      due_date: t.due_date ?? undefined,
    }))
  return {
    counts: {
      not_started: count('not_started'),
      in_progress: count('in_progress'),
      waiting_decision: count('waiting_decision'),
      done: count('done'),
    },
    open,
  }
}

async function getBudgetAndExpenses(client: ReturnType<typeof createClient>, coupleId: string) {
  const [budgetsRes, expensesRes, catsRes] = await Promise.all([
    client.from('budgets').select('category_id,amount_cny').eq('couple_id', coupleId),
    client
      .from('expenses')
      .select('name,category_id,amount,currency,rmb_amount,expense_date')
      .eq('couple_id', coupleId)
      .is('deleted_at', null),
    client.from('budget_categories').select('id,name').eq('couple_id', coupleId),
  ])
  if (budgetsRes.error) throw new Error(budgetsRes.error.message)
  if (expensesRes.error) throw new Error(expensesRes.error.message)
  if (catsRes.error) throw new Error(catsRes.error.message)

  const cats = (catsRes.data ?? []) as { id: string; name: string }[]
  const budgets = (budgetsRes.data ?? []) as { category_id: string; amount_cny: number }[]
  const expenses = (expensesRes.data ?? []) as {
    name: string
    category_id: string
    amount: number
    currency: string
    rmb_amount: number
    expense_date: string
  }[]
  const nameById = new Map(cats.map((c) => [c.id, c.name]))
  const budgetByCat = new Map(budgets.map((b) => [b.category_id, Number(b.amount_cny ?? 0)]))
  const spentByCat = new Map<string, number>()
  let spent = 0
  for (const e of expenses) {
    const rmb = Number(e.rmb_amount ?? 0)
    spent += rmb
    spentByCat.set(e.category_id, (spentByCat.get(e.category_id) ?? 0) + rmb)
  }
  const total = [...budgetByCat.values()].reduce((s, v) => s + v, 0)
  const budget = {
    total,
    spent,
    remaining: total - spent,
    categories: [...budgetByCat.keys()].map((cid) => {
      const s = spentByCat.get(cid) ?? 0
      const b = budgetByCat.get(cid) ?? 0
      return { name: nameById.get(cid) ?? '未分类', budget: b, spent: s, remaining: b - s }
    }),
  }
  const expensesView = {
    recent: [...expenses]
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
      .slice(0, 5)
      .map((e) => ({
        name: e.name,
        category: nameById.get(e.category_id) ?? '未分类',
        amount: Number(e.amount ?? 0),
        currency: e.currency,
        rmb_amount: Number(e.rmb_amount ?? 0),
        expense_date: e.expense_date,
      })),
    categoryRatio: [...spentByCat.entries()]
      .map(([cid, amount]) => ({
        category: nameById.get(cid) ?? '未分类',
        amount,
        pct: spent > 0 ? Math.round((amount / spent) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
  }
  return { budget, expensesView }
}

// 按动作只取必要上下文（减少无效数据 → 提速）
async function fetchContextFor(
  client: ReturnType<typeof createClient>,
  coupleId: string,
  userId: string,
  action: AiAction,
): Promise<AiContext> {
  const base = await getBaseInfo(client, coupleId)
  const myHistory = await getMyHistory(client, userId, action === 'chat' ? 3 : 8)
  const ctx: AiContext = { ...base, myHistory }

  if (action === 'summary' || action === 'next_steps' || action === 'plan_tasks') {
    ctx.timeline = await getTimeline(client, coupleId)
    ctx.tasks = await getTasks(client, coupleId)
  }
  if (action === 'risk' || action === 'period_summary') {
    ctx.timeline = await getTimeline(client, coupleId)
    ctx.tasks = await getTasks(client, coupleId)
    const { budget, expensesView } = await getBudgetAndExpenses(client, coupleId)
    ctx.budget = budget
    ctx.expenses = expensesView
  }
  if (action === 'chat') {
    // 普通问答：只带最小必要信息（空间名/阶段 + 最近 3 条事项 + 未来 3 个节点）
    const [timeline, tasks] = await Promise.all([
      getTimeline(client, coupleId),
      getTasks(client, coupleId, 3),
    ])
    ctx.timeline = {
      total: timeline.total,
      past: timeline.past,
      upcoming: timeline.upcoming.slice(0, 3),
    }
    ctx.tasks = tasks
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
function buildSystemPrompt(context: AiContext, action: AiAction): string {
  return `你是「Wedding OS」的婚前提醒助手，帮助情侣推进婚礼准备，不做笔记工具。
重要：私人数据仅属于当前用户，不得引用、泄露或推断其他成员私人信息。
上下文（JSON）：
${JSON.stringify(context, null, 2)}

必须只输出合法 JSON（不要输出 JSON 之外的内容），结构：
{"type":"...","content":"面向用户的回答文本","tasks":[{"title":"事项标题","category":"分类","note":"备注"}]}

type 与动作要求：
- summary：婚礼进度提醒。结合时间轴与事项，给出进度概览，尽量包含“距离 XX 还有 N 天”这类具体提醒。
- next_steps：只输出当前最重要的 3 件事（content 中用 1. 2. 3. 排列），基于当前阶段、时间距离与未完成事项，不要泛泛而谈。
- risk：识别长时间未处理事项、即将到期事项、预算异常（超支/剩余紧张），输出风险与具体应对建议。
- plan_tasks：把用户需求拆成事项清单（必须填 tasks，1-8 条）。
- period_summary：周/月总结（完成内容、花费、下一步）。
- chat：简洁、具体的问答，可结合“距离 XX 还有 N 天”给出提醒。

任何情况下都不编造上下文里不存在的数据；不允许输出删除、修改、自动执行类操作。`
}

function buildActionPrompt(action: AiAction, input: string): string {
  switch (action) {
    case 'summary':
      return '请输出当前婚礼进度提醒。'
    case 'next_steps':
      return '请根据当前阶段、时间轴距离和未完成事项，输出当前最重要的 3 件事。'
    case 'plan_tasks':
      return `用户需求：${input || '帮我规划'}\n请把需求拆成具体可执行的事项清单（tasks）。`
    case 'risk':
      return '请识别当前最大的风险（事项拖延/即将到期/预算异常）并给出应对建议。'
    case 'period_summary':
      return '请输出周/月总结：完成了什么、花费多少、下一步是什么。'
    default:
      return input || '请结合上下文，给出简洁具体的回答。'
  }
}

// ---------------------------------------------------------------------------
// 豆包 API（火山方舟，OpenAI 兼容）
// 预留流式：未来可传 stream:true 并按 SSE 逐字返回（StreamChunk 结构已注释）
// ---------------------------------------------------------------------------
interface StreamChunk {
  delta: string
  done: boolean
}

async function callDoubao(messages: { role: string; content: string }[]): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DOUBAO_API_KEY}`,
      },
      body: JSON.stringify({
        model: DOUBAO_MODEL,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        stream: false,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`豆包 API ${res.status}: ${body.slice(0, 300)}`)
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return json.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(timer)
  }
}

function parseResult(raw: string): {
  type: string
  content: string
  tasks?: { title: string; category?: string; note?: string }[]
} {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    const obj = JSON.parse(cleaned) as {
      type?: string
      content?: string
      tasks?: { title?: string; category?: string; note?: string }[]
    }
    return {
      type: obj.type ?? 'chat',
      content: obj.content ?? '（AI 未返回内容）',
      tasks: (obj.tasks ?? [])
        .map((t) => ({ title: (t.title ?? '').trim(), category: t.category?.trim(), note: t.note?.trim() }))
        .filter((t) => t.title),
    }
  } catch {
    return { type: 'chat', content: cleaned || '（AI 未返回内容）' }
  }
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (!DOUBAO_API_KEY) {
    return Response.json({ error: 'AI 服务未配置（缺少 DOUBAO_API_KEY）' }, {
      status: 500,
      headers: corsHeaders,
    })
  }

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const token = auth.replace('Bearer ', '')
    if (!token) {
      return Response.json({ error: '未登录' }, { status: 401, headers: corsHeaders })
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return Response.json({ error: '登录状态无效' }, { status: 401, headers: corsHeaders })
    }

    const ctxClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    })
    const members = await ctxClient
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', user.id)
      .limit(1)
    if (members.error || !members.data || members.data.length === 0) {
      return Response.json({ error: '尚未加入情侣空间' }, { status: 403, headers: corsHeaders })
    }
    const coupleId = members.data[0].couple_id as string

    const body = (await req.json()) as { action?: AiAction; input?: string }
    const action = body.action ?? 'chat'
    const input = (body.input ?? '').trim()
    const startedAt = Date.now()
    const context = await fetchContextFor(ctxClient, coupleId, user.id, action)
    const contextBytes = JSON.stringify(context).length

    const messages = [
      { role: 'system', content: buildSystemPrompt(context, action) },
      { role: 'user', content: buildActionPrompt(action, input) },
    ]
    const raw = await callDoubao(messages)
    const elapsedMs = Date.now() - startedAt
    console.log(
      '[ai-assistant]',
      JSON.stringify({ userId: user.id, action, contextBytes, elapsedMs }),
    )
    const result = parseResult(raw)
    return Response.json(
      { ok: true, ...result, debug: { userId: user.id, elapsedMs, contextBytes } },
      { headers: corsHeaders },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `AI 请求失败：${msg}` }, {
      status: 500,
      headers: corsHeaders,
    })
  }
})
