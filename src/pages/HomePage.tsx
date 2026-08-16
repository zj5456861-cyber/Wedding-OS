import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AiAssistant from '../components/AiAssistant'
import { Icon } from '../components/Icons'
import {
  updateImportantEvent,
  updateStage,
  type Couple,
  type ImportantEventMode,
} from '../lib/couple'
import { toChineseError } from '../lib/errors'
import {
  fetchBudgetOverview,
  fetchEventReminders,
  fetchOpenTaskCount,
  fetchRecentLogs,
  fetchRecentTasks,
  fetchTaskReminders,
  fetchUpcomingEvents,
  localDateStr,
  momentParts,
  reminderDateOf,
  type ActivityLog,
} from '../lib/dashboard'
import { TASK_STATUS_LABELS } from '../lib/tasks'
import type { TimelineEvent } from '../lib/timeline'
import type { TabKey } from './MainShell'

const ACTION_LABELS: Record<string, string> = {
  create: '创建了',
  update: '更新了',
  delete: '删除了',
  status_change: '变更了',
}

const ENTITY_LABELS: Record<string, string> = {
  tasks: '事项',
  timeline_events: '时间节点',
  couple_members: '成员',
  couples: '空间',
  budget_categories: '花销分类',
  budgets: '预算',
  expenses: '支出',
  attachments: '附件',
}

const MOMENT_PRESETS = ['收房', '装修开始', '婚礼', '领证', '旅行', '纪念日']

const COVER_INDEX: { key: TabKey; label: string }[] = [
  { key: 'timeline', label: '时间轴' },
  { key: 'tasks', label: '事项' },
  { key: 'budget', label: '账本' },
  { key: 'mine', label: '我们' },
]

export default function HomePage({
  couple,
  onGoTab,
  onCoupleChange,
}: {
  couple: Couple
  onGoTab: (tab: TabKey) => void
  onCoupleChange: () => void | Promise<void>
}) {
  const queryClient = useQueryClient()
  const [aiOpen, setAiOpen] = useState(false)
  const [showAllLogs, setShowAllLogs] = useState(false)

  // 重要时刻
  const [momentEditing, setMomentEditing] = useState(false)
  const [momentTitle, setMomentTitle] = useState(couple.important_event_title ?? '')
  const [momentDate, setMomentDate] = useState(couple.important_event_date ?? '')
  const [momentMode, setMomentMode] = useState<ImportantEventMode>(
    couple.important_event_display_mode === 'months' ? 'months' : 'days',
  )
  const [savingMoment, setSavingMoment] = useState(false)
  const [momentMessage, setMomentMessage] = useState('')

  // 当前阶段
  const [stageEditing, setStageEditing] = useState(false)
  const [stageName, setStageName] = useState(couple.stage_name)
  const [savingStage, setSavingStage] = useState(false)
  const [stageMessage, setStageMessage] = useState('')

  const today = localDateStr(new Date())
  const in30 = localDateStr(new Date(Date.now() + 30 * 86400000))

  const upcoming = useQuery({
    queryKey: ['home', couple.id, 'upcoming'],
    queryFn: () => fetchUpcomingEvents(couple.id, 3),
  })
  const recentTasks = useQuery({
    queryKey: ['home', couple.id, 'tasks'],
    queryFn: () => fetchRecentTasks(couple.id, 3),
  })
  const budget = useQuery({
    queryKey: ['home', couple.id, 'budget'],
    queryFn: () => fetchBudgetOverview(couple.id),
  })
  const taskReminders = useQuery({
    queryKey: ['home', couple.id, 'reminders-task'],
    queryFn: () => fetchTaskReminders(couple.id, today, in30),
  })
  const eventReminders = useQuery({
    queryKey: ['home', couple.id, 'reminders-event'],
    queryFn: () => fetchEventReminders(couple.id, today, in30),
  })
  const logs = useQuery({
    queryKey: ['home', couple.id, 'logs'],
    queryFn: () => fetchRecentLogs(couple.id, 10),
  })
  const openCount = useQuery({
    queryKey: ['home', couple.id, 'open-count'],
    queryFn: () => fetchOpenTaskCount(couple.id),
  })

  const reminders = buildReminderList(taskReminders.data ?? [], eventReminders.data ?? [])
  const visibleLogs = showAllLogs ? logs.data ?? [] : (logs.data ?? []).slice(0, 1)
  const momentTitleValue = (couple.important_event_title ?? '').trim()
  const momentDateValue = couple.important_event_date ?? ''
  const momentModeValue: ImportantEventMode =
    couple.important_event_display_mode === 'months' ? 'months' : 'days'

  function openMomentEditor() {
    setMomentTitle(couple.important_event_title ?? '')
    setMomentDate(couple.important_event_date ?? '')
    setMomentMode(momentModeValue)
    setMomentMessage('')
    setMomentEditing(true)
  }

  async function saveMoment() {
    if (!momentTitle.trim() || !momentDate) {
      setMomentMessage('请填写名称和日期')
      return
    }
    setSavingMoment(true)
    setMomentMessage('')
    try {
      const { logged } = await updateImportantEvent(couple.id, {
        title: momentTitle,
        date: momentDate,
        display_mode: momentMode,
      })
      await onCoupleChange()
      void queryClient.invalidateQueries({ queryKey: ['home', couple.id] })
      setMomentEditing(false)
      if (!logged) setMomentMessage('已保存（动态记录写入失败）')
    } catch (err) {
      setMomentMessage(toChineseError(err))
    } finally {
      setSavingMoment(false)
    }
  }

  function openStageEditor() {
    setStageName(couple.stage_name)
    setStageMessage('')
    setStageEditing(true)
  }

  async function saveStage() {
    if (!stageName.trim()) {
      setStageMessage('请填写阶段名称')
      return
    }
    setSavingStage(true)
    setStageMessage('')
    try {
      const { logged } = await updateStage(couple.id, stageName)
      await onCoupleChange()
      void queryClient.invalidateQueries({ queryKey: ['home', couple.id] })
      setStageEditing(false)
      if (!logged) setStageMessage('已保存（动态记录写入失败）')
    } catch (err) {
      setStageMessage(toChineseError(err))
    } finally {
      setSavingStage(false)
    }
  }

  return (
    <div>
      {/* 封面 · 高级请柬式 Hero */}
      <div className="hero">
        <p className="hero-eyebrow">Wedding OS · 我们的家</p>
        <h1 className="hero-title">{couple.name}</h1>
        <p className="hero-subtitle">Our Home</p>
        <div className="ornament">
          <Icon name="heart" size={13} />
        </div>
        <div className="countdown">
          {momentDateValue ? (
            (() => {
              const p = momentParts(momentDateValue)
              const label = momentTitleValue || '重要时刻'
              if (p.days >= 0) {
                const monthly = momentModeValue === 'months'
                return (
                  <>
                    <p className="countdown-label">距离 {label} 还有</p>
                    <div className={`countdown-num ${monthly ? 'monthly' : ''}`}>
                      {monthly && p.months > 0
                        ? `${p.months}个月${p.remainingDays}天`
                        : `${p.days}天`}
                    </div>
                    <p className="countdown-date">{momentDateValue}</p>
                  </>
                )
              }
              return (
                <>
                  <p className="countdown-label">{label} · {momentDateValue}</p>
                  <p className="countdown-date">这个时刻已经到来</p>
                </>
              )
            })()
          ) : (
            <p className="countdown-label">设置一个重要时刻，记录你们的下一个日子</p>
          )}
          <div style={{ marginTop: 8 }}>
            <button className="moment-edit" onClick={openMomentEditor}>
              {momentDateValue ? '修改重要时刻' : '设置重要时刻'}
            </button>
          </div>
        </div>
        <div className="cover-index">
          {COVER_INDEX.map((c) => (
            <button key={c.key} className="cover-item" onClick={() => onGoTab(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 重要时刻编辑 */}
      {momentEditing && (
        <div className="card">
          <div className="module-head">
            <p className="module-kicker">重要时刻</p>
            <h2 className="module-title">设置重要时刻</h2>
          </div>
          <label>名称</label>
          <input
            placeholder="例如：收房 / 装修开始 / 婚礼 / 领证 / 旅行 / 纪念日"
            value={momentTitle}
            onChange={(e) => setMomentTitle(e.target.value)}
          />
          <div className="stamp-row" style={{ margin: '6px 0 0' }}>
            {MOMENT_PRESETS.map((p) => (
              <button key={p} type="button" className="stamp" onClick={() => setMomentTitle(p)}>
                {p}
              </button>
            ))}
          </div>
          <label>日期</label>
          <input type="date" value={momentDate} onChange={(e) => setMomentDate(e.target.value)} />
          <label>展示方式</label>
          <div className="stamp-row">
            <button
              type="button"
              className={`stamp ${momentMode === 'days' ? 'active' : ''}`}
              onClick={() => setMomentMode('days')}
            >
              按天
            </button>
            <button
              type="button"
              className={`stamp ${momentMode === 'months' ? 'active' : ''}`}
              onClick={() => setMomentMode('months')}
            >
              按月
            </button>
          </div>
          {momentMessage && <p className="error">{momentMessage}</p>}
          <button type="button" className="primary" disabled={savingMoment} onClick={saveMoment}>
            {savingMoment ? '保存中…' : '保存'}
          </button>
          <button type="button" className="secondary" onClick={() => setMomentEditing(false)}>
            取消
          </button>
        </div>
      )}

      {/* 当前阶段 */}
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">阶段</p>
          <h2 className="module-title">当前阶段</h2>
        </div>
        <p className="stage-line">
          <span className="stage-label">当前阶段</span>
          <span className="stage-value">{couple.stage_name}</span>
        </p>
        <p className="muted">相关事项 {openCount.data ?? 0} 件待处理</p>
        {stageEditing ? (
          <>
            <label>阶段名称</label>
            <input
              placeholder="例如：婚前准备 / 等待收房 / 装修设计 / 搬入新家 / 婚礼筹备"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
            />
            {stageMessage && <p className="error">{stageMessage}</p>}
            <button type="button" className="primary" disabled={savingStage} onClick={saveStage}>
              {savingStage ? '保存中…' : '保存'}
            </button>
            <button type="button" className="secondary" onClick={() => setStageEditing(false)}>
              取消
            </button>
          </>
        ) : (
          <button className="link" onClick={openStageEditor}>
            编辑当前阶段
          </button>
        )}
        {upcoming.data && upcoming.data.length > 0 && (
          <>
            <p className="muted" style={{ marginTop: 12 }}>
              接下来
            </p>
            {upcoming.data.map((ev) => (
              <div className="paper-row" key={ev.id}>
                <span className="row-date">{ev.event_date.slice(5)}</span>
                <div className="row-main">
                  <p className="row-title">{ev.title}</p>
                  <p className="row-meta">{ev.category ?? '时间节点'}</p>
                </div>
              </div>
            ))}
          </>
        )}
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <button className="link" onClick={() => onGoTab('timeline')}>
            打开时间轴
            <Icon name="chevron" size={12} />
          </button>
        </div>
      </div>

      {/* 重要事项 */}
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">清单</p>
          <h2 className="module-title">重要事项</h2>
        </div>
        {recentTasks.isLoading && <p className="muted">加载中…</p>}
        {recentTasks.error && <p className="error">{toChineseError(recentTasks.error)}</p>}
        {recentTasks.data && recentTasks.data.length > 0
          ? recentTasks.data.map((t, i) => (
              <div className="paper-row" key={t.id}>
                <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
                <div className="row-main">
                  <p className="row-title">{t.title}</p>
                  <p className="row-meta">{t.category ?? '事项'}</p>
                </div>
                <span
                  className={`stamp ${t.status === 'done' ? 'done' : ''}`}
                  style={{ pointerEvents: 'none' }}
                >
                  {TASK_STATUS_LABELS[t.status]}
                </span>
              </div>
            ))
          : !recentTasks.isLoading && (
              <div className="empty-state" style={{ padding: '10px 4px 6px' }}>
                <Icon name="tasks" size={56} className="empty-icon" />
                <p className="muted">还没有事项，先写下第一件吧。</p>
              </div>
            )}
        {reminders.length > 0 && (
          <div className="paper-inset">
            <p className="inset-label">近期提醒</p>
            {reminders.map((r) => (
              <div className="paper-row" key={r.key} style={{ padding: '7px 0' }}>
                <span className="row-date">{r.date.slice(5)}</span>
                <p className="row-meta" style={{ margin: 0 }}>
                  {r.label}
                </p>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <button className="link" onClick={() => onGoTab('tasks')}>
            打开事项
            <Icon name="chevron" size={12} />
          </button>
        </div>
      </div>

      {/* 花销概览 */}
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">账本</p>
          <h2 className="module-title">花销概览</h2>
        </div>
        {budget.isLoading && <p className="muted">加载中…</p>}
        {budget.error && <p className="error">{toChineseError(budget.error)}</p>}
        {budget.data && (
          <div className="stat-grid">
            <div className="stat">
              <div className="stat-num">{formatMoney(budget.data.budgetTotal)}</div>
              <div className="stat-label">总预算</div>
            </div>
            <div className="stat">
              <div className="stat-num">{formatMoney(budget.data.spentTotal)}</div>
              <div className="stat-label">总支出</div>
            </div>
            <div className="stat">
              <div className="stat-num">
                {formatMoney(budget.data.budgetTotal - budget.data.spentTotal)}
              </div>
              <div className="stat-label">剩余金额</div>
            </div>
          </div>
        )}
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <button className="link" onClick={() => onGoTab('budget')}>
            打开账本
            <Icon name="chevron" size={12} />
          </button>
        </div>
      </div>

      {/* 最近动态 */}
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">记录</p>
          <h2 className="module-title">动态</h2>
        </div>
        {logs.isLoading && <p className="muted">加载中…</p>}
        {logs.error && <p className="error">{toChineseError(logs.error)}</p>}
        {logs.data && logs.data.length > 0 ? (
          <div className="logs-collapse">
            {visibleLogs.map((l) => {
              const j = formatLog(l)
              return (
                <div className="journal-row" key={l.id}>
                  <span className="journal-time">{j.time}</span>
                  <span className="journal-text">{j.text}</span>
                </div>
              )
            })}
            {logs.data.length > 1 && (
              <div style={{ textAlign: 'right' }}>
                <button className="link" onClick={() => setShowAllLogs((v) => !v)}>
                  {showAllLogs ? '收起' : `展开全部（${logs.data.length}）`}
                </button>
              </div>
            )}
          </div>
        ) : (
          !logs.isLoading && (
            <div className="empty-state">
              <Icon name="heart" size={56} className="empty-icon" />
              <p className="muted">还没有动态，开始记录你们的第一步吧</p>
            </div>
          )
        )}
      </div>

      <button className="ai-fab" aria-label="AI 婚前助手" onClick={() => setAiOpen(true)}>
        <span className="fab-icon">
          <Icon name="heart" size={22} />
        </span>
      </button>
      {aiOpen && <AiAssistant couple={couple} onClose={() => setAiOpen(false)} />}
    </div>
  )
}

function buildReminderList(
  tasks: {
    id: string
    title: string
    reminder_date: string | null
  }[],
  events: TimelineEvent[],
): { key: string; date: string; label: string }[] {
  return [
    ...tasks.map((t) => ({
      key: `task-${t.id}`,
      date: t.reminder_date ?? '',
      label: `事项「${t.title}」`,
    })),
    ...events.map((ev) => ({
      key: `event-${ev.id}`,
      date: reminderDateOf(ev) ?? '',
      label: `节点「${ev.title}」`,
    })),
  ]
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
}

function formatMoney(n: number): string {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function formatLog(l: ActivityLog): { time: string; text: string } {
  const d = new Date(l.created_at)
  const time = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0',
  )} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const actor = l.actorDisplayName ?? '成员'
  const action = ACTION_LABELS[l.action] ?? `${l.action}了`
  const entity = ENTITY_LABELS[l.entity_type] ?? l.entity_type
  const title = getLogTitle(l)
  return { time, text: `${actor}${action}${entity}${title ? `「${title}」` : ''}` }
}

function getLogTitle(l: ActivityLog): string | null {
  if (!l.summary) return null
  const candidate = (l.summary.new as { title?: unknown } | undefined)?.title
  const title =
    typeof candidate === 'string'
      ? candidate
      : (l.summary.old as { title?: unknown } | undefined)?.title
  return typeof title === 'string' && title ? title : null
}
