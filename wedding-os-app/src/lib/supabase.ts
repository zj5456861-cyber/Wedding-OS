import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// 登录体验：session 始终持久化到 localStorage（App 级登录体验），
// 关闭浏览器重新打开后保持登录。仅保存邮箱到 localStorage，不保存密码。
const LAST_EMAIL_KEY = 'wedding-os:last-email'

export function getLastEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveLastEmail(email: string): void {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, email)
  } catch {
    // 隐私模式等场景忽略
  }
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
