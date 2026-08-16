import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Icon } from '../components/Icons'
import type { Couple } from '../lib/couple'
import { reminderDateOf } from '../lib/dashboard'
import { toChineseError } from '../lib/errors'
import {
  createTimelineEvent,
  deleteTimelineEvent,
  fetchTimelineEvents,
  updateTimelineEvent,
  type TimelineEvent,
  type TimelineEventInput,
} from '../lib/timeline'

const CATEGORIES = ['装修', '订婚', '旅行', '婚纱照', '婚礼', '其他']

export default function TimelinePage({ couple }: { couple: Couple }) {
  const queryClient = useQueryClient()
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['timeline', couple.id],
    queryFn: () => fetchTimelineEvents(couple.id),
  })
  const [editing, setEditing] = useState<TimelineEvent | 'new' | null>(null)
  const [formError, setFormError] = useState('')

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['timeline', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['home', couple.id] })
  }

  const save = useMutation({
    mutationFn: (input: { id?: string; values: TimelineEventInput }) =>
      input.id
        ? updateTimelineEvent(input.id, input.values)
        : createTimelineEvent(couple.id, input.values),
    onSuccess: () => {
      invalidate()
      setEditing(null)
      setFormError('')
    },
    onError: (err) => setFormError(toChineseError(err)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteTimelineEvent(id),
    onSuccess: () => invalidate(),
    onError: (err) => setFormError(toChineseError(err)),
  })

  return (
    <div>
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">时间轴</p>
          <h2 className="module-title">重要日子</h2>
        </div>
        <p className="muted">共 {events.length} 个节点，按开始日期排序</p>
        <button
          className="primary"
          onClick={() => {
            setFormError('')
            setEditing(editing ? null : 'new')
          }}
        >
          {editing ? '取消新增' : '新增节点'}
        </button>
      </div>

      {editing && (
        <EventForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? undefined : editing}
          submitting={save.isPending}
          error={formError}
          onCancel={() => setEditing(null)}
          onSubmit={(values) =>
            save.mutate({
              id: editing === 'new' ? undefined : editing.id,
              values,
            })
          }
        />
      )}

      {isLoading && <p className="muted">加载中…</p>}
      {error && <p className="error">{toChineseError(error)}</p>}

      {!isLoading && !error && events.length > 0 && (
        <div className="paper-plain">
          {events.map((ev, i) => (
            <div className="paper-row" key={ev.id}>
              <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
              <div className="row-main">
                <p className="row-title">{ev.title}</p>
                <p className="row-meta">
                  {ev.event_date}
                  {ev.end_date ? ` ~ ${ev.end_date}` : ''}
                  {ev.category ? ` · ${ev.category}` : ''}
                </p>
                {ev.reminder_days_before != null && (
                  <p className="row-meta">
                    提前 {ev.reminder_days_before} 天提醒（{reminderDateOf(ev) ?? '-'}）
                  </p>
                )}
                {ev.note && <p className="row-note">{ev.note}</p>}
              </div>
              <div className="row-actions">
                <button
                  className="icon-btn"
                  aria-label="编辑节点"
                  onClick={() => {
                    setFormError('')
                    setEditing(ev)
                  }}
                >
                  <Icon name="edit" size={15} />
                </button>
                <button
                  className="icon-btn danger-btn"
                  aria-label="删除节点"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`删除节点「${ev.title}」？`)) remove.mutate(ev.id)
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <Icon name="timeline" size={56} className="empty-icon" />
            <p className="muted">还没有时间节点，点「新增节点」创建第一个。</p>
          </div>
        </div>
      )}
    </div>
  )
}

function EventForm({
  initial,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: TimelineEvent
  submitting: boolean
  error: string
  onSubmit: (values: TimelineEventInput) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [eventDate, setEventDate] = useState(initial?.event_date ?? '')
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [reminderDays, setReminderDays] = useState(
    initial?.reminder_days_before != null ? String(initial.reminder_days_before) : '',
  )
  const [category, setCategory] = useState(initial?.category ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !eventDate) return
    onSubmit({
      title: title.trim(),
      event_date: eventDate,
      end_date: endDate || null,
      reminder_days_before: reminderDays === '' ? null : Math.max(0, Number(reminderDays) || 0),
      category: category.trim() || null,
      note: note.trim() || null,
    })
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="module-head">
        <p className="module-kicker">时间轴</p>
        <h2 className="module-title">{initial ? '编辑节点' : '新增节点'}</h2>
      </div>
      <label>标题</label>
      <input required value={title} onChange={(e) => setTitle(e.target.value)} />
      <label>开始日期</label>
      <input
        type="date"
        required
        value={eventDate}
        onChange={(e) => setEventDate(e.target.value)}
      />
      <label>结束日期（可空）</label>
      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      <label>提前提醒天数（可空，如 30 = 提前 30 天提醒）</label>
      <input
        type="number"
        min="0"
        step="1"
        value={reminderDays}
        onChange={(e) => setReminderDays(e.target.value)}
      />
      <label>分类</label>
      <input
        list="timeline-categories"
        placeholder="装修 / 订婚 / 旅行 / 婚纱照 / 婚礼 / 其他"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <datalist id="timeline-categories">
        {CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <label>备注</label>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? '保存中…' : '保存'}
      </button>
      <button type="button" className="secondary" onClick={onCancel}>
        取消
      </button>
    </form>
  )
}
