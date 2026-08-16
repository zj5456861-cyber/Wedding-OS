import { supabase } from './supabase'

export interface Couple {
  id: string
  name: string
  invite_code: string
  stage_name: string
  important_event_title?: string | null
  important_event_date?: string | null
  important_event_display_mode?: string | null
  met_date?: string | null
  love_date?: string | null
  cover_url?: string | null
  created_at: string
}

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type ImportantEventMode = 'days' | 'months'

export function makeInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
  }
  return code
}

export async function fetchMyCouple(): Promise<Couple | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: members, error } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', user.id)
  if (error) throw error
  if (!members || members.length === 0) return null

  const { data: couple, error: coupleError } = await supabase
    .from('couples')
    .select('*')
    .eq('id', members[0].couple_id)
    .single()
  if (coupleError) throw coupleError
  return couple
}

export async function createCouple(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_couple', { p_name: name })
  if (error) throw error
  return data as string
}

export async function joinCouple(inviteCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_couple', {
    p_invite_code: inviteCode,
  })
  if (error) throw error
  return data as string
}

export async function updateCouple(
  id: string,
  patch: Partial<Pick<Couple, 'invite_code' | 'stage_name' | 'name'>>,
): Promise<void> {
  const { error } = await supabase.from('couples').update(patch).eq('id', id)
  if (error) throw error
}

// 重要时刻：双方成员均可修改（RLS 校验成员身份），成功后写入 activity_logs
export async function updateImportantEvent(
  id: string,
  input: { title: string; date: string | null; display_mode: ImportantEventMode },
): Promise<{ logged: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')

  const { data: old, error: fetchError } = await supabase
    .from('couples')
    .select('important_event_title,important_event_date')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const patch = {
    important_event_title: input.title.trim() || null,
    important_event_date: input.date || null,
    important_event_display_mode: input.display_mode,
  }
  const { error } = await supabase.from('couples').update(patch).eq('id', id)
  if (error) throw error

  const { error: logError } = await supabase.from('activity_logs').insert({
    couple_id: id,
    actor_id: user.id,
    action: 'update',
    entity_type: 'couples',
    entity_id: id,
    summary: {
      old: {
        important_event_title: old?.important_event_title ?? null,
        important_event_date: old?.important_event_date ?? null,
      },
      new: {
        important_event_title: patch.important_event_title,
        important_event_date: patch.important_event_date,
      },
    },
  })
  return { logged: !logError }
}

// 当前阶段：双方成员均可修改，成功后写入 activity_logs
export async function updateStage(
  id: string,
  stageName: string,
): Promise<{ logged: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')

  const { data: old, error: fetchError } = await supabase
    .from('couples')
    .select('stage_name')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const patch = { stage_name: stageName.trim() }
  const { error } = await supabase.from('couples').update(patch).eq('id', id)
  if (error) throw error

  const { error: logError } = await supabase.from('activity_logs').insert({
    couple_id: id,
    actor_id: user.id,
    action: 'update',
    entity_type: 'couples',
    entity_id: id,
    summary: {
      old: { stage_name: old?.stage_name ?? '' },
      new: { stage_name: patch.stage_name },
    },
  })
  return { logged: !logError }
}

// 相识 / 恋爱日期：双方成员均可修改，成功后写入 activity_logs
export async function updateAnniversaryDates(
  id: string,
  input: { met_date: string | null; love_date: string | null },
): Promise<{ logged: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')

  const { data: old, error: fetchError } = await supabase
    .from('couples')
    .select('met_date,love_date')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const patch = {
    met_date: input.met_date || null,
    love_date: input.love_date || null,
  }
  const { error } = await supabase.from('couples').update(patch).eq('id', id)
  if (error) throw error

  const { error: logError } = await supabase.from('activity_logs').insert({
    couple_id: id,
    actor_id: user.id,
    action: 'update',
    entity_type: 'couples',
    entity_id: id,
    summary: {
      old: { met_date: old?.met_date ?? null, love_date: old?.love_date ?? null },
      new: { met_date: patch.met_date, love_date: patch.love_date },
    },
  })
  return { logged: !logError }
}

// 空间改名：双方成员均可改（RLS 校验成员身份），成功后写入 activity_logs
export async function renameCouple(
  id: string,
  name: string,
): Promise<{ logged: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')

  const { data: old, error: fetchError } = await supabase
    .from('couples')
    .select('name')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError
  const oldName = (old as { name?: string } | null)?.name ?? ''

  const { error } = await supabase.from('couples').update({ name }).eq('id', id)
  if (error) throw error

  const { error: logError } = await supabase.from('activity_logs').insert({
    couple_id: id,
    actor_id: user.id,
    action: 'update',
    entity_type: 'couples',
    entity_id: id,
    summary: { old: { name: oldName }, new: { name } },
  })
  return { logged: !logError }
}
