import { supabase } from './supabase'

export interface TimelineEvent {
  id: string
  couple_id: string
  title: string
  event_date: string
  end_date: string | null
  reminder_days_before: number | null
  category: string | null
  note: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export interface TimelineEventInput {
  title: string
  event_date: string
  end_date: string | null
  reminder_days_before: number | null
  category: string | null
  note: string | null
}

export async function fetchTimelineEvents(coupleId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('timeline_events')
    .select('*')
    .eq('couple_id', coupleId)
    .is('deleted_at', null)
    .order('event_date', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TimelineEvent[]
}

export async function createTimelineEvent(
  coupleId: string,
  input: TimelineEventInput,
): Promise<void> {
  const { error } = await supabase.from('timeline_events').insert({
    couple_id: coupleId,
    title: input.title.trim(),
    event_date: input.event_date,
    end_date: input.end_date || null,
    reminder_days_before: input.reminder_days_before ?? null,
    category: input.category?.trim() || null,
    note: input.note?.trim() || null,
  })
  if (error) throw error
}

export async function updateTimelineEvent(
  id: string,
  input: TimelineEventInput,
): Promise<void> {
  const { error } = await supabase
    .from('timeline_events')
    .update({
      title: input.title.trim(),
      event_date: input.event_date,
      end_date: input.end_date || null,
      reminder_days_before: input.reminder_days_before ?? null,
      category: input.category?.trim() || null,
      note: input.note?.trim() || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('timeline_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
