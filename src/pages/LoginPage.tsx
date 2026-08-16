import { useState, type FormEvent } from 'react'
import { getLastEmail, saveLastEmail, supabase } from '../lib/supabase'
import { toChineseError } from '../lib/errors'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(getLastEmail())
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (err) throw err
        saveLastEmail(email.trim())
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
        })
        if (err) throw err
        saveLastEmail(email.trim())
        if (!data.session) {
          setInfo('注册成功，请查收邮箱中的确认链接，确认后再登录。')
        }
      }
    } catch (err) {
      setError(toChineseError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-center">
      <div className="card form-card">
        <h1>Wedding OS</h1>
        <p className="muted">{mode === 'login' ? '登录你们的空间' : '注册新账号'}</p>
        <form onSubmit={onSubmit}>
          <label>邮箱</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label>密码</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
          <button type="submit" disabled={loading} className="primary">
            {loading ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
            setInfo('')
          }}
        >
          {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
        </button>
      </div>
    </div>
  )
}
