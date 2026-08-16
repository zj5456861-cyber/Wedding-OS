import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/AuthProvider'
import { Icon } from '../components/Icons'
import { LineIllustration } from '../components/Illustrations'
import { supabase } from '../lib/supabase'
import { toChineseError } from '../lib/errors'
import {
  makeInviteCode,
  renameCouple,
  updateAnniversaryDates,
  updateCouple,
  type Couple,
} from '../lib/couple'
import { fetchBudgetOverview } from '../lib/dashboard'
import { fetchTravelSummary } from '../lib/travel'
import {
  fetchMembers,
  fetchMyProfile,
  updateMyAvatarUrl,
  updateMyNickname,
} from '../lib/members'
import {
  getSignedUrl,
  setCoverUrl,
  uploadAvatar,
  uploadCover,
} from '../lib/storage'
import { TASK_STATUS_LABELS } from '../lib/tasks'
import type { TabKey } from './MainShell'

export default function MyPage({
  couple,
  onCoupleChange,
  onGoTab,
}: {
  couple: Couple
  onCoupleChange: () => void | Promise<void>
  onGoTab: (tab: TabKey) => void
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: me } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => fetchMyProfile(),
  })
  const { data: memberData } = useQuery({
    queryKey: ['we-members', couple.id],
    queryFn: async () => {
      const members = await fetchMembers(couple.id)
      const urls: Record<string, string | null> = {}
      for (const m of members) {
        urls[m.user_id] = await getSignedUrl(m.avatar_url)
      }
      return { members, urls }
    },
  })
  const { data: coverUrl } = useQuery({
    queryKey: ['we-cover', couple.id, couple.cover_url],
    queryFn: () => getSignedUrl(couple.cover_url ?? null),
  })
  const { data: counts } = useQuery({
    queryKey: ['we-stats', couple.id],
    queryFn: async () => {
      const [tasks, events, expenses] = await Promise.all([
        supabase
          .from('tasks')
          .select('id')
          .eq('couple_id', couple.id)
          .is('deleted_at', null)
          .eq('status', 'done'),
        supabase
          .from('timeline_events')
          .select('id')
          .eq('couple_id', couple.id)
          .is('deleted_at', null),
        supabase
          .from('expenses')
          .select('id')
          .eq('couple_id', couple.id)
          .is('deleted_at', null),
      ])
      return {
        done: tasks.data?.length ?? 0,
        events: events.data?.length ?? 0,
        expenses: expenses.data?.length ?? 0,
      }
    },
  })
  const { data: budget } = useQuery({
    queryKey: ['we-budget', couple.id],
    queryFn: () => fetchBudgetOverview(couple.id),
  })
  const { data: travel } = useQuery({
    queryKey: ['we-travel', couple.id],
    queryFn: () => fetchTravelSummary(couple.id),
  })

  const [name, setName] = useState(couple.name)
  const [nickname, setNickname] = useState('')
  const [stageName, setStageName] = useState(couple.stage_name)
  const [renaming, setRenaming] = useState(false)
  const [savingNick, setSavingNick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [travelOpen, setTravelOpen] = useState(false)
  const [annivEditing, setAnnivEditing] = useState(false)
  const [metDate, setMetDate] = useState(couple.met_date ?? '')
  const [loveDate, setLoveDate] = useState(couple.love_date ?? '')
  const [savingAnniv, setSavingAnniv] = useState(false)
  const [annivMessage, setAnnivMessage] = useState('')
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (me) setNickname(me.display_name ?? '')
  }, [me])

  const members = memberData?.members ?? []
  const avatarUrls = memberData?.urls ?? {}
  const connected = members.length >= 2
  const togetherBase =
    couple.love_date ?? couple.met_date ?? couple.created_at.slice(0, 10)
  const travelCount =
    (travel?.events.length ?? 0) + (travel?.tasks.length ?? 0) + (travel?.expenses.length ?? 0)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['me-profile'] })
    void queryClient.invalidateQueries({ queryKey: ['we-members', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['we-cover', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['we-budget', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['we-travel', couple.id] })
    void queryClient.invalidateQueries({ queryKey: ['home', couple.id] })
  }

  const saveNick = useMutation({
    mutationFn: (value: string) => updateMyNickname(value),
    onSuccess: () => {
      invalidate()
      setMessage('昵称已保存')
    },
    onError: (err) => setMessage(`保存失败：${toChineseError(err)}`),
  })

  async function onAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setMessage('')
    try {
      const path = await uploadAvatar(couple.id, user.id, file)
      await updateMyAvatarUrl(path)
      invalidate()
      setMessage('头像已更新')
    } catch (err) {
      setMessage(`头像上传失败：${toChineseError(err)}`)
    }
  }

  async function onCoverFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMessage('')
    try {
      const path = await uploadCover(couple.id, file)
      await setCoverUrl(couple.id, path)
      await onCoupleChange()
      invalidate()
      setMessage('空间封面已更新')
    } catch (err) {
      setMessage(`封面上传失败：${toChineseError(err)}`)
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault()
    setRenaming(true)
    setMessage('')
    try {
      const { logged } = await renameCouple(couple.id, name.trim() || '我们的家')
      await onCoupleChange()
      setMessage(logged ? '空间名称已保存' : '空间名称已保存（动态记录写入失败）')
    } catch {
      setMessage('保存失败，请重试')
    } finally {
      setRenaming(false)
    }
  }

  async function saveStage(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await updateCouple(couple.id, { stage_name: stageName.trim() || '婚前准备' })
      await onCoupleChange()
      setMessage('已保存')
    } catch {
      setMessage('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function saveAnniv() {
    setSavingAnniv(true)
    setAnnivMessage('')
    try {
      const { logged } = await updateAnniversaryDates(couple.id, {
        met_date: metDate || null,
        love_date: loveDate || null,
      })
      await onCoupleChange()
      invalidate()
      setAnnivEditing(false)
      if (!logged) setAnnivMessage('已保存（动态记录写入失败）')
    } catch (err) {
      setAnnivMessage(toChineseError(err))
    } finally {
      setSavingAnniv(false)
    }
  }

  async function resetCode() {
    setMessage('')
    try {
      await updateCouple(couple.id, { invite_code: makeInviteCode() })
      await onCoupleChange()
      setMessage('邀请码已重置')
    } catch {
      setMessage('重置失败，请重试')
    }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <div>
      {/* 相册首页 · 情侣空间封面 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="we-cover">
          {coverUrl ? <img src={coverUrl} alt="空间封面" /> : null}
        </div>
        <div style={{ padding: '14px 18px 18px' }}>
          <div className="couple-row">
            {members.map((m) => (
              <div key={m.user_id} className="couple-avatar">
                {avatarUrls[m.user_id] ? (
                  <img src={avatarUrls[m.user_id] ?? undefined} alt={m.display_name} />
                ) : (
                  m.display_name?.charAt(0) || '·'
                )}
              </div>
            ))}
          </div>
          <div className="couple-ornament">
            <LineIllustration type="hearts" />
          </div>
          <div className="couple-names">
            {members.map((m) => m.display_name || '未设置昵称').join(' & ')}
          </div>

          <div className="anniv-line">
            <span className="anniv-label">在一起</span>
            <span className="anniv-text">{togetherText(togetherBase)}</span>
            <button className="link" style={{ margin: 0 }} onClick={() => setAnnivEditing(true)}>
              设置纪念日
            </button>
          </div>
          {annivEditing && (
            <div className="paper-inset" style={{ textAlign: 'left' }}>
              <p className="inset-label">相识与恋爱</p>
              <label>相识日期（可空）</label>
              <input type="date" value={metDate} onChange={(e) => setMetDate(e.target.value)} />
              <label>恋爱开始日期（可空）</label>
              <input type="date" value={loveDate} onChange={(e) => setLoveDate(e.target.value)} />
              {annivMessage && <p className="error">{annivMessage}</p>}
              <button className="primary" disabled={savingAnniv} onClick={saveAnniv}>
                {savingAnniv ? '保存中…' : '保存'}
              </button>
              <button className="secondary" onClick={() => setAnnivEditing(false)}>
                取消
              </button>
            </div>
          )}

          <div className="album-links">
            <button className="album-link" onClick={() => onGoTab('tasks')}>
              <span className="album-link-head">
                <span className="album-link-label">共同完成</span>
                <Icon name="chevron" size={14} />
              </span>
              <span className="album-link-num">{counts?.done ?? 0}</span>
              <span className="album-link-sub">已完成事项</span>
            </button>
            <button className="album-link" onClick={() => onGoTab('budget')}>
              <span className="album-link-head">
                <span className="album-link-label">共同花销</span>
                <Icon name="chevron" size={14} />
              </span>
              <span className="album-link-num">¥ {formatMoney(budget?.spentTotal ?? 0)}</span>
              <span className="album-link-sub">已花费</span>
            </button>
            <button className="album-link" onClick={() => setTravelOpen((v) => !v)}>
              <span className="album-link-head">
                <span className="album-link-label">旅行记录</span>
                <Icon name="chevron" size={14} />
              </span>
              <span className="album-link-num">{travelCount}</span>
              <span className="album-link-sub">节点 / 事项 / 花销</span>
            </button>
            <button className="album-link" onClick={() => onGoTab('timeline')}>
              <span className="album-link-head">
                <span className="album-link-label">重要日子</span>
                <Icon name="chevron" size={14} />
              </span>
              <span className="album-link-num">{counts?.events ?? 0}</span>
              <span className="album-link-sub">时间节点</span>
            </button>
          </div>

          <p className="muted" style={{ textAlign: 'center', marginTop: 12 }}>
            {couple.name} · {connected ? '已连接' : '等待另一半加入'} · {members.length}/2
            {connected && (
              <span
                style={{
                  display: 'inline-flex',
                  verticalAlign: '-2px',
                  marginLeft: 5,
                  color: 'var(--gold-deep)',
                }}
              >
                <Icon name="heart" size={13} />
              </span>
            )}
          </p>
          <div style={{ textAlign: 'center' }}>
            <button className="upload-btn" onClick={() => coverInput.current?.click()}>
              更换空间封面
            </button>
          </div>
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            hidden
            onChange={onCoverFile}
          />
        </div>
      </div>

      {/* 旅行记录 */}
      {travelOpen && (
        <div className="card">
          <div className="module-head">
            <p className="module-kicker">旅行</p>
            <h2 className="module-title">旅行记录</h2>
          </div>
          {!travel && <p className="muted">加载中…</p>}
          {travel && (
            <>
              <p className="muted">时间节点 {travel.events.length} · 事项 {travel.tasks.length} · 花销 {travel.expenses.length}</p>
              {travel.events.length > 0 && (
                <>
                  <p className="inset-label">时间节点</p>
                  {travel.events.map((ev) => (
                    <div className="paper-row" key={ev.id} style={{ padding: '7px 0' }}>
                      <span className="row-date">{ev.event_date.slice(5)}</span>
                      <p className="row-meta" style={{ margin: 0 }}>
                        {ev.title}
                      </p>
                    </div>
                  ))}
                </>
              )}
              {travel.tasks.length > 0 && (
                <>
                  <p className="inset-label">事项</p>
                  {travel.tasks.map((t) => (
                    <div className="paper-row" key={t.id} style={{ padding: '7px 0' }}>
                      <span className="row-index" style={{ minWidth: 20 }}>
                        {TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? '·'}
                      </span>
                      <p className="row-meta" style={{ margin: 0 }}>
                        {t.title}
                      </p>
                    </div>
                  ))}
                </>
              )}
              {travel.expenses.length > 0 && (
                <>
                  <p className="inset-label">花销</p>
                  {travel.expenses.map((e) => (
                    <div className="paper-row" key={e.id} style={{ padding: '7px 0' }}>
                      <span className="row-date">{e.expense_date.slice(5)}</span>
                      <p className="row-meta" style={{ margin: 0, flex: 1 }}>
                        {e.name}
                      </p>
                      <span className="row-amount">¥ {formatMoney(Number(e.rmb_amount))}</span>
                    </div>
                  ))}
                </>
              )}
              {travel.events.length === 0 && travel.tasks.length === 0 && travel.expenses.length === 0 && (
                <p className="muted">还没有旅行记录，先在时间轴或事项里规划旅行吧</p>
              )}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="secondary" onClick={() => onGoTab('timeline')}>
                  去时间轴
                </button>
                <button className="secondary" onClick={() => onGoTab('tasks')}>
                  去事项
                </button>
                <button className="secondary" onClick={() => setTravelOpen(false)}>
                  收起
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 成员 */}
      <div className="card">
        <div className="module-head">
          <p className="module-kicker">成员</p>
          <h2 className="module-title">我们的成员</h2>
        </div>
        {members.map((m) => (
          <div className="member-row" key={m.user_id}>
            <div className="avatar">
              {avatarUrls[m.user_id] ? (
                <img src={avatarUrls[m.user_id] ?? undefined} alt={m.display_name} />
              ) : (
                m.display_name?.charAt(0) || '·'
              )}
            </div>
            <div className="flex-1">
              <p>{m.display_name || '未设置昵称'}</p>
              <p className="muted">邮箱：{m.email || '—'}</p>
              <p className="muted">加入时间：{m.joined_at ? formatDate(m.joined_at) : '—'}</p>
            </div>
            {m.user_id === user?.id && (
              <button className="upload-btn" onClick={() => avatarInput.current?.click()}>
                换头像
              </button>
            )}
          </div>
        ))}
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          hidden
          onChange={onAvatarFile}
        />
      </div>

      {/* 空间设置（折叠纸页） */}
      <div className="card">
        <details className="settings-paper">
          <summary>空间设置</summary>
          <div className="settings-body">
            <label>我的昵称（显示在最近动态中）</label>
            <div className="row">
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
              <button
                className="secondary"
                disabled={savingNick || nickname.trim() === ''}
                onClick={() => {
                  setSavingNick(true)
                  saveNick.mutate(nickname.trim(), {
                    onSettled: () => setSavingNick(false),
                  })
                }}
              >
                {savingNick ? '保存中…' : '保存昵称'}
              </button>
            </div>
            <p className="muted">登录邮箱：{me?.email}</p>

            <form onSubmit={saveName}>
              <label>空间名称（双方成员均可修改）</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
              <button type="submit" disabled={renaming} className="primary">
                {renaming ? '保存中…' : '保存'}
              </button>
            </form>

            <label>邀请码</label>
            <p className="invite-code">{couple.invite_code}</p>
            <button className="secondary" onClick={resetCode}>
              重置邀请码
            </button>

            <form onSubmit={saveStage}>
              <label>当前阶段</label>
              <input value={stageName} onChange={(e) => setStageName(e.target.value)} />
              <button type="submit" disabled={saving} className="primary">
                {saving ? '保存中…' : '保存'}
              </button>
            </form>

            {message && <p className="info">{message}</p>}
            <div className="paper-rule" />
            <button className="danger" onClick={logout}>
              退出登录
            </button>
          </div>
        </details>
      </div>
    </div>
  )
}

function togetherText(fromIso: string): string {
  const from = new Date(fromIso.slice(0, 10) + 'T00:00:00')
  const now = new Date()
  let y = now.getFullYear() - from.getFullYear()
  let m = now.getMonth() - from.getMonth()
  let d = now.getDate() - from.getDate()
  if (d < 0) {
    m -= 1
    d += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (m < 0) {
    y -= 1
    m += 12
  }
  if (y > 0) return `${y}年${m}个月${d}天`
  if (m > 0) return `${m}个月${d}天`
  return `${d}天`
}

function formatMoney(n: number): string {
  return n.toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
  })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}
