// 全局中文错误提示：网络错误 / RLS 拒绝 / 邀请码错误等统一映射为可读文案
export function toChineseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('INVITE_CODE_INVALID')) return '邀请码无效，请检查后重试'
  if (msg.includes('COUPLE_FULL')) return '空间已满（最多 2 人）'
  if (msg.includes('Invalid login credentials')) return '邮箱或密码错误'
  if (msg.includes('Email not confirmed')) return '邮箱尚未确认，请先查收确认邮件'
  if (msg.includes('already registered')) return '该邮箱已注册，请直接登录'
  if (msg.includes('Password should be at least')) return '密码至少 6 位'
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.toLowerCase().includes('network')
  ) {
    return '网络连接失败，请检查网络后重试'
  }
  if (
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('RLS')
  ) {
    return '没有权限访问该数据'
  }
  if (msg.includes('Edge Function') || msg.includes('Functions')) {
    return 'AI 服务暂不可用（未部署或配置缺失）'
  }
  return msg
}
