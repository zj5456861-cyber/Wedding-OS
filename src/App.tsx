import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { useAuth } from './lib/AuthProvider'
import { fetchMyCouple, type Couple } from './lib/couple'
import LoginPage from './pages/LoginPage'
import WorkspacePage from './pages/WorkspacePage'
import MainShell from './pages/MainShell'

export default function App() {
  const { loading: authLoading, session } = useAuth()
  const [couple, setCouple] = useState<Couple | null>(null)
  const [coupleLoading, setCoupleLoading] = useState(true)

  const reloadCouple = useCallback(async () => {
    try {
      setCouple(await fetchMyCouple())
    } catch {
      setCouple(null)
    }
  }, [])

  // 登录状态变化时加载/清空情侣空间
  useEffect(() => {
    if (!session) {
      setCouple(null)
      setCoupleLoading(false)
      return
    }
    setCoupleLoading(true)
    void reloadCouple().finally(() => setCoupleLoading(false))
  }, [session, reloadCouple])

  if (!isSupabaseConfigured) {
    return (
      <div className="page-center">
        <h1>Wedding OS</h1>
        <p>未配置 Supabase。</p>
        <p>请将 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY 填入 .env 后重启。</p>
      </div>
    )
  }

  // 启动恢复中：先显示加载页，避免登录页闪烁
  if (authLoading) {
    return <div className="page-center">加载中…</div>
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/auth" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    )
  }

  if (coupleLoading) {
    return <div className="page-center">加载中…</div>
  }

  if (!couple) {
    return (
      <Routes>
        <Route path="/space" element={<WorkspacePage onEntered={reloadCouple} />} />
        <Route path="*" element={<Navigate to="/space" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/auth" element={<Navigate to="/" replace />} />
      <Route path="/space" element={<Navigate to="/" replace />} />
      <Route path="*" element={<MainShell couple={couple} onCoupleChange={reloadCouple} />} />
    </Routes>
  )
}
