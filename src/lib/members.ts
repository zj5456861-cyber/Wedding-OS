import { supabase } from './supabase'

export interface Member {
  user_id: string
  display_name: string
  email: string
  joined_at: string | null
  avatar_url: string | null
}

export async function fetchMembers(coupleId: string): Promise<Member[]> {
  const { data: members, error } = await supabase
    .from('couple_members')
    .select('user_id,joined_at')
    .eq('couple_id', coupleId)
  if (error) throw error
  const rows = (members ?? []) as { user_id: string; joined_at: string | null }[]
  const ids = rows.map((m) => m.user_id)
  if (ids.length === 0) return []
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id,display_name,email,avatar_url')
    .in('id', ids)
  if (pErr) throw pErr
  const nameById = new Map(
    (profiles ?? []).map((p) => [
      (p as { id: string }).id,
      (p as { display_name?: string | null }).display_name?.trim() || '',
    ]),
  )
  const emailById = new Map(
    (profiles ?? []).map((p) => [
      (p as { id: string }).id,
      (p as { email?: string | null }).email ?? '',
    ]),
  )
  const avatarById = new Map(
    (profiles ?? []).map((p) => [
      (p as { id: string }).id,
      (p as { avatar_url?: string | null }).avatar_url ?? null,
    ]),
  )
  const joinedById = new Map(rows.map((m) => [m.user_id, m.joined_at]))
  return ids.map((id) => ({
    user_id: id,
    display_name: nameById.get(id) ?? '',
    email: emailById.get(id) ?? '',
    joined_at: joinedById.get(id) ?? null,
    avatar_url: avatarById.get(id) ?? null,
  }))
}

export async function updateMyNickname(displayName: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', user.id)
  if (error) throw error
}

export interface MyProfile {
  email: string
  display_name: string
}

export async function fetchMyProfile(): Promise<MyProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()
  return {
    email: user.email ?? '',
    display_name: (data as { display_name?: string | null } | null)?.display_name ?? '',
  }
}

export async function updateMyAvatarUrl(path: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: path })
    .eq('id', user.id)
  if (error) throw error
}
