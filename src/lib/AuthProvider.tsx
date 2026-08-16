import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { saveLastEmail, supabase } from './supabase'

export interface AuthState {
  loading: boolean
  session: Session | null
  user: User | null
}

const AuthContext = createContext<AuthState>({ loading: true, session: null, user: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, session: null, user: null })

  useEffect(() => {
    let mounted = true

    // 启动时从 localStorage 恢复 session（persistSession=true 默认存 localStorage）
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setState({ loading: false, session, user: session?.user ?? null })
      if (session?.user?.email) saveLastEmail(session.user.email)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setState({ loading: false, session, user: session?.user ?? null })
      if (session?.user?.email) saveLastEmail(session.user.email)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
