// ============================================================================
// 事项系统 · 一级分类管理验收脚本
// 真实数据库读写（仅 anon key，RLS 负责权限）。
// 用法：pnpm verify:cats（或 node scripts/verify-task-categories.mjs）
// 配置：.env 中的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / TEST_USER_A_*
// 前提：已按顺序执行 0015 → 0016 → 0017 → 0018 迁移
// ============================================================================

import fs from 'node:fs'

function loadEnv() {
  const out = {}
  try {
    const text = fs.readFileSync('.env', 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // 仅用进程环境变量
  }
  const env = { ...out, ...process.env }
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'TEST_USER_A_EMAIL',
    'TEST_USER_A_PASSWORD',
  ]
  const missing = required.filter((k) => !env[k])
  if (missing.length) {
    console.error('缺少配置：' + missing.join(', '))
    process.exit(1)
  }
  return env
}

const cfg = loadEnv()
const BASE = cfg.VITE_SUPABASE_URL.replace(/\/$/, '')
const ANON = cfg.VITE_SUPABASE_ANON_KEY

let passed = 0
let failed = 0
function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  [通过] ${name}${detail ? ' — ' + detail : ''}`)
  } else {
    failed++
    console.error(`  [失败] ${name}${detail ? ' — ' + detail : ''}`)
  }
}

async function api(path, { token, method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  if (prefer) headers.Prefer = prefer
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`)
  return data
}

async function signIn(email, password) {
  return api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  })
}

async function main() {
  const ts = Date.now()
  const catName = `验收-蜜月旅行-${ts}`
  const newName = `验收-新家装修-${ts}`

  let a = await signIn(cfg.TEST_USER_A_EMAIL, cfg.TEST_USER_A_PASSWORD)
  check('A 登录成功', Boolean(a.access_token))
  const token = a.access_token

  // 0. 找到 A 的空间
  const couples = await api('/rest/v1/couples?select=id&limit=1', { token })
  const coupleId = couples?.[0]?.id
  check('A 有可用情侣空间', Boolean(coupleId), coupleId ? coupleId.slice(0, 8) : '')
  if (!coupleId) {
    console.log(`\n===== 结果：通过 ${passed} 项，失败 ${failed} 项 =====`)
    process.exit(failed === 0 ? 0 : 1)
  }

  // 1-4. 新增分类 → 立即可见
  let catId = null
  try {
    const [created] = await api('/rest/v1/task_categories', {
      token,
      method: 'POST',
      prefer: 'return=representation',
      body: { couple_id: coupleId, name: catName, sort_order: 999 },
    })
    catId = created?.id ?? null
    check('新增分类成功（点击添加分类 → 输入名称 → 保存）', Boolean(catId))
    const list = await api(
      `/rest/v1/task_categories?couple_id=eq.${coupleId}&name=eq.${encodeURIComponent(catName)}&select=id,name,sort_order,created_at`,
      { token },
    )
    check('页面出现新分类', list.length === 1 && list[0].name === catName)
    const list2 = await api(
      `/rest/v1/task_categories?couple_id=eq.${coupleId}&name=eq.${encodeURIComponent(catName)}&select=id`,
      { token },
    )
    check('再次查询（模拟刷新）仍存在', list2.length === 1)
  } catch (err) {
    check('新增分类成功（点击添加分类 → 输入名称 → 保存）', false, String(err))
  }

  // 5-6. 修改分类名称 → 关联事项保持 → 刷新仍保持
  try {
    // 先在旧名称下建一个事项，验证改名后仍关联
    const [task] = await api('/rest/v1/tasks', {
      token,
      method: 'POST',
      prefer: 'return=representation',
      body: { couple_id: coupleId, title: `验收事项-${ts}`, category: catName, status: 'not_started' },
    })
    check('旧名称下创建关联事项成功', Boolean(task?.id))

    await api(`/rest/v1/task_categories?id=eq.${catId}`, {
      token,
      method: 'PATCH',
      body: { name: newName },
    })
    await api(
      `/rest/v1/tasks?couple_id=eq.${coupleId}&category=eq.${encodeURIComponent(catName)}`,
      {
        token,
        method: 'PATCH',
        body: { category: newName },
      },
    )
    const after = await api(
      `/rest/v1/task_categories?couple_id=eq.${coupleId}&id=eq.${catId}&select=id,name`,
      { token },
    )
    check('修改分类名称后数据库同步', after.length === 1 && after[0].name === newName)
    const taskAfter = await api(
      `/rest/v1/tasks?couple_id=eq.${coupleId}&id=eq.${task.id}&select=category`,
      { token },
    )
    check('改名后关联事项保持（装修 → 新家装修）', taskAfter[0]?.category === newName)
    const again = await api(
      `/rest/v1/task_categories?couple_id=eq.${coupleId}&id=eq.${catId}&select=name`,
      { token },
    )
    check('再次查询（模拟刷新）名称仍保持', again[0]?.name === newName)
  } catch (err) {
    check('修改分类名称', false, String(err))
  }

  // 7. 删除分类（含事项 → 同时删除）
  try {
    const tasksLeft = await api(
      `/rest/v1/tasks?couple_id=eq.${coupleId}&category=eq.${encodeURIComponent(newName)}&select=id`,
      { token },
    )
    await api(
      `/rest/v1/tasks?couple_id=eq.${coupleId}&category=eq.${encodeURIComponent(newName)}`,
      {
        token,
        method: 'PATCH',
        body: { deleted_at: new Date().toISOString() },
      },
    )
    await api(`/rest/v1/task_categories?id=eq.${catId}`, {
      token,
      method: 'PATCH',
      body: { deleted_at: new Date().toISOString() },
    })
    const cats = await api(
      `/rest/v1/task_categories?couple_id=eq.${coupleId}&id=eq.${catId}&select=id`,
      { token },
    )
    const tasksAfter = await api(
      `/rest/v1/tasks?couple_id=eq.${coupleId}&category=eq.${encodeURIComponent(newName)}&select=id`,
      { token },
    )
    check(
      '删除分类时同时删除其事项（确认后）',
      cats.length === 0 && tasksLeft.length > 0 && tasksAfter.length === 0,
      `分类下 ${tasksLeft.length} 个事项已一并删除`,
    )
  } catch (err) {
    check('删除分类时同时删除其事项', false, String(err))
  }

  // 清理：删除可能残留的测试数据
  try {
    const leftover = await api(
      `/rest/v1/task_categories?couple_id=eq.${coupleId}&or=(name.eq.${encodeURIComponent(catName)},name.eq.${encodeURIComponent(newName)})&select=id`,
      { token },
    )
    for (const c of leftover) {
      await api(`/rest/v1/task_categories?id=eq.${c.id}`, {
        token,
        method: 'PATCH',
        body: { deleted_at: new Date().toISOString() },
      })
    }
    const leftoverTasks = await api(
      `/rest/v1/tasks?couple_id=eq.${coupleId}&or=(category.eq.${encodeURIComponent(catName)},category.eq.${encodeURIComponent(newName)})&select=id`,
      { token },
    )
    for (const t of leftoverTasks) {
      await api(`/rest/v1/tasks?id=eq.${t.id}`, {
        token,
        method: 'PATCH',
        body: { deleted_at: new Date().toISOString() },
      })
    }
    console.log(`  已清理测试数据：分类 ${leftover.length}，事项 ${leftoverTasks.length}`)
  } catch {
    // 清理失败不判失败
  }

  console.log(`\n===== 结果：通过 ${passed} 项，失败 ${failed} 项 =====`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
