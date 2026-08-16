import { supabase } from './supabase'
import { createTask } from './tasks'

export type AiAction =
  | 'summary'
  | 'next_steps'
  | 'plan_tasks'
  | 'risk'
  | 'period_summary'
  | 'chat'

export interface AiResponse {
  ok?: boolean
  type: string
  content: string
  tasks?: { title: string; category?: string; note?: string }[]
}

// 调用 Edge Function（AI 只读；Key 在服务端）
export async function requestAi(action: AiAction, input?: string): Promise<AiResponse> {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: { action, input: input ?? '' },
  })
  if (error) throw error
  return data as AiResponse
}

// 记录 AI 建议（前端用户视角写入，RLS 校验成员 + 本人）
export async function recordSuggestion(
  coupleId: string,
  userId: string,
  type: string,
  content: string,
  userPrompt?: string,
  accepted?: boolean,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('ai_suggestions')
    .insert({
      couple_id: coupleId,
      user_id: userId,
      suggestion_type: type,
      user_prompt: userPrompt ?? null,
      content: content.slice(0, 5000),
      accepted: accepted ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: number } | null)?.id ?? null
}

export async function markSuggestionAccepted(id: number): Promise<void> {
  const { error } = await supabase
    .from('ai_suggestions')
    .update({ accepted: true })
    .eq('id', id)
  if (error) throw error
}

// 用户确认后写入 AI 生成的事项草稿（走现有业务接口，AI 不直接写库）
export async function addDraftTasks(
  coupleId: string,
  tasks: { title: string; category?: string; note?: string }[],
): Promise<void> {
  for (const t of tasks) {
    await createTask(coupleId, {
      title: t.title,
      category: t.category ?? '其他',
      status: 'not_started',
      due_date: null,
      reminder_date: null,
      note: t.note ?? null,
    })
  }
}
