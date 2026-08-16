import { useState, type FormEvent } from 'react'
import { createCouple, joinCouple } from '../lib/couple'
import { toChineseError } from '../lib/errors'

type Mode = 'create' | 'join'

export default function WorkspacePage({
  onEntered,
}: {
  onEntered: () => void
}) {
  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'create') {
        await createCouple(name.trim() || '我们的家')
      } else {
        await joinCouple(code.trim())
      }
      await onEntered()
    } catch (err) {
      setError(toChineseError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-center">
      <div className="card form-card">
        <h1>创建或加入情侣空间</h1>
        <p className="muted">两个人的数据只属于这一个空间</p>
        <form onSubmit={onSubmit}>
          {mode === 'create' ? (
            <>
              <label>空间名称</label>
              <input
                placeholder="例如：我们的家"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" disabled={loading} className="primary">
                {loading ? '创建中…' : '创建空间'}
              </button>
            </>
          ) : (
            <>
              <label>邀请码</label>
              <input
                placeholder="6 位邀请码"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button type="submit" disabled={loading} className="primary">
                {loading ? '加入中…' : '加入空间'}
              </button>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </form>
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'create' ? 'join' : 'create')
            setError('')
          }}
        >
          {mode === 'create' ? '另一半有空间？用邀请码加入' : '还没有空间？创建一个'}
        </button>
      </div>
    </div>
  )
}
