import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/AuthProvider'
import { Icon, type IconName } from './Icons'
import type { Couple } from '../lib/couple'
import { supabase } from '../lib/supabase'
import { toChineseError } from '../lib/errors'
import {
  addDraftTasks,
  markSuggestionAccepted,
  recordSuggestion,
  requestAi,
  type AiAction,
} from '../lib/ai'

interface ChatMsg {
  id: string
  role: 'user' | 'ai'
  content: string
  tasks?: { title: string; category?: string; note?: string }[]
  suggestionId?: number | null
  draftAdded?: boolean
}

interface SuggestionRow {
  id: number
  suggestion_type: string
  user_prompt: string | null
  content: string
  accepted: boolean | null
}

const QUICK_ACTIONS: { label: string; action: AiAction; prompt: string; icon: IconName }[] = [
  { label: '查看当前婚礼进度', action: 'summary', prompt: '查看当前婚礼进度', icon: 'summary' },
  { label: '下一步应该做什么', action: 'next_steps', prompt: '下一步应该做什么', icon: 'next' },
  {
    label: '帮我检查遗漏',
    action: 'chat',
    prompt: '帮我检查有没有遗漏的事项或时间节点，列出需要补的',
    icon: 'check',
  },
  {
    label: '生成准备清单',
    action: 'plan_tasks',
    prompt: '生成一份最近需要准备的清单',
    icon: 'list',
  },
  {
    label: '总结最近进展',
    action: 'period_summary',
    prompt: '总结最近进展',
    icon: 'calendar',
  },
]

const STAGE_HINTS: Record<AiAction, string[]> = {
  summary: ['正在查看婚礼进度…', '正在整理时间轴与事项…', '正在生成进度总结…'],
  next_steps: ['正在分析当前阶段…', '正在梳理事项与时间距离…', '正在生成建议…'],
  risk: ['正在检查事项状态…', '正在对比计划与日期…', '正在输出风险提醒…'],
  period_summary: ['正在汇总最近进展…', '正在统计花销…', '正在生成总结…'],
  plan_tasks: ['正在理解需求…', '正在生成准备清单…', '正在整理草稿…'],
  chat: ['正在思考…', '正在结合上下文…', '正在整理回答…'],
}

let msgSeq = 0
function newId(): string {
  msgSeq += 1
  return `m${Date.now()}-${msgSeq}`
}

export default function AiAssistant({
  couple,
  onClose,
}: {
  couple: Couple
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendingHint, setSendingHint] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const historyLoaded = useRef(false)
  const hintTimers = useRef<number[]>([])

  const { data: history } = useQuery({
    // 关键：查询键必须包含 user.id，否则 A 的缓存会串给 B（同一浏览器切换账号）
    queryKey: ['ai-history', couple.id, user?.id ?? 'anon'],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('id,suggestion_type,user_prompt,content,accepted')
        .eq('user_id', user.id)
        .eq('couple_id', couple.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return ((data ?? []) as SuggestionRow[]).reverse()
    },
    enabled: Boolean(user),
  })

  useEffect(() => {
    if (history && !historyLoaded.current) {
      historyLoaded.current = true
      const msgs: ChatMsg[] = []
      for (const s of history) {
        if (s.user_prompt) {
          msgs.push({ id: newId(), role: 'user', content: s.user_prompt })
        }
        msgs.push({
          id: newId(),
          role: 'ai',
          content: s.content,
          suggestionId: s.id,
          draftAdded: s.accepted === true,
        })
      }
      if (msgs.length) setMessages(msgs)
    }
  }, [history])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, sending])

  function startPhaseHints(action: AiAction) {
    const hints = STAGE_HINTS[action] ?? STAGE_HINTS.chat
    setSendingHint(hints[0])
    hintTimers.current.forEach((t) => window.clearTimeout(t))
    hintTimers.current = [
      window.setTimeout(() => setSendingHint(hints[1] ?? hints[0]), 3000),
      window.setTimeout(() => setSendingHint(hints[2] ?? hints[1] ?? hints[0]), 6000),
    ]
  }

  function stopPhaseHints() {
    hintTimers.current.forEach((t) => window.clearTimeout(t))
    hintTimers.current = []
    setSendingHint('')
  }

  async function send(prompt: string, action: AiAction = 'chat') {
    const text = prompt.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    startPhaseHints(action)
    const userMsg: ChatMsg = { id: newId(), role: 'user', content: text }
    setMessages((ms) => [...ms, userMsg])
    setInput('')
    try {
      const res = await requestAi(action, text)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      let suggestionId: number | null = null
      if (user) {
        try {
          suggestionId = await recordSuggestion(couple.id, user.id, res.type, res.content, text)
        } catch {
          // 记录失败不影响对话
        }
      }
      setMessages((ms) => [
        ...ms,
        {
          id: newId(),
          role: 'ai',
          content: res.content,
          tasks: res.tasks,
          suggestionId,
          draftAdded: false,
        },
      ])
      void queryClient.invalidateQueries({ queryKey: ['ai-history', couple.id] })
    } catch (err) {
      setError(toChineseError(err))
    } finally {
      stopPhaseHints()
      setSending(false)
    }
  }

  async function confirmTasks(msg: ChatMsg) {
    if (!msg.tasks?.length || sending) return
    setSending(true)
    setError('')
    try {
      await addDraftTasks(couple.id, msg.tasks)
      if (msg.suggestionId != null) {
        await markSuggestionAccepted(msg.suggestionId).catch(() => undefined)
      }
      setMessages((ms) =>
        ms.map((m) => (m.id === msg.id ? { ...m, draftAdded: true } : m)),
      )
      void queryClient.invalidateQueries({ queryKey: ['tasks', couple.id] })
      void queryClient.invalidateQueries({ queryKey: ['home', couple.id] })
      void queryClient.invalidateQueries({ queryKey: ['ai-history', couple.id] })
    } catch (err) {
      setError(toChineseError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="ai-mask" onClick={onClose}>
      <div className="ai-panel chat" onClick={(e) => e.stopPropagation()}>
        <div className="ai-panel-head">
          <div className="ai-avatar">
            <Icon name="heart" />
          </div>
          <div className="flex-1">
            <b>AI 婚前助手</b>
            <p className="muted">我是你们的婚前小助手，可以问我关于进度、清单与提醒的任何问题</p>
          </div>
          <button className="link" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="ai-chat" ref={scrollRef}>
          {messages.length === 0 && !sending && (
            <div className="empty-state">
              <Icon name="heart" className="empty-illu" />
              <p className="muted">
                选择下方快捷功能，或直接问我：「五月去欧洲拍婚纱照，现在该准备什么？」
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`ai-note ${m.role === 'user' ? 'user' : ''}`}>
              <p style={{ margin: 0 }}>{m.content}</p>
              {m.tasks && m.tasks.length > 0 && (
                <div className="ai-tasks">
                  <p className="muted">AI 生成事项草稿（需你确认后才写入）：</p>
                  {m.tasks.map((t, i) => (
                    <p key={i}>
                      · {t.title}
                      {t.category ? `（${t.category}）` : ''}
                    </p>
                  ))}
                  {!m.draftAdded ? (
                    <button
                      className="primary"
                      disabled={sending}
                      onClick={() => confirmTasks(m)}
                    >
                      确认添加 {m.tasks.length} 个事项
                    </button>
                  ) : (
                    <p className="info">已添加到「事项」</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {sending && <div className="ai-note">{sendingHint || '正在整理…'}</div>}
        </div>

        <div className="ai-actions">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.label}
              className="secondary"
              disabled={sending}
              onClick={() => send(q.prompt, q.action)}
            >
              <Icon name={q.icon} size={15} />
              {q.label}
            </button>
          ))}
        </div>

        <div className="ai-input-row">
          <input
            placeholder="输入你的问题…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) send(input, 'chat')
            }}
          />
          <button
            className="primary"
            disabled={sending || !input.trim()}
            onClick={() => send(input, 'chat')}
          >
            {sending ? '思考中…' : '发送'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
