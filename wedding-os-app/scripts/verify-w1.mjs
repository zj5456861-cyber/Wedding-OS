// ============================================================================
// W1 数据结构与双人隔离验证脚本
// 仅使用 anon key（RLS 负责权限），不使用 service_role。
// 用法：pnpm verify:w1（或 node scripts/verify-w1.mjs）
// 配置见 .env.example：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY + A/B/C 三个测试账号
// 前提：A/B/C 已注册（若开启邮箱确认，需先完成确认）
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
    // .env 不存在时仅使用进程环境变量
  }
  const env = { ...out, ...process.env }
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'TEST_USER_A_EMAIL',
    'TEST_USER_A_PASSWORD',
    'TEST_USER_B_EMAIL',
    'TEST_USER_B_PASSWORD',
    'TEST_USER_C_EMAIL',
    'TEST_USER_C_PASSWORD',
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
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`)
  }
  return data
}

async function signIn(email, password) {
  const data = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  })
  return data
}

async function me(token) {
  return api('/auth/v1/user', { token })
}

function run(name, fn) {
  console.log(`\n== ${name} ==`)
  return fn()
}

async function main() {
  // 1. A 登录（注册由用户预先完成；若开启邮箱确认需先确认）
  let a = null
  let b = null
  let c = null
  await run('1. 用户 A 登录', async () => {
    try {
      a = await signIn(cfg.TEST_USER_A_EMAIL, cfg.TEST_USER_A_PASSWORD)
      check('A 登录成功', Boolean(a.access_token))
    } catch (err) {
      check('A 登录成功', false, String(err))
    }
  })

  await run('2. 用户 A 创建情侣空间', async () => {
    try {
      const coupleId = await api('/rest/v1/rpc/create_couple', {
        token: a.access_token,
        method: 'POST',
        body: { p_name: '验收空间 A' },
      })
      check('create_couple 返回 couple_id', typeof coupleId === 'string' && coupleId.length > 0)
      if (typeof coupleId === 'string') {
        const events = await api(
          `/rest/v1/timeline_events?couple_id=eq.${coupleId}&select=id&limit=1`,
          { token: a.access_token },
        )
        check('创建后自动生成时间节点种子', Array.isArray(events) && events.length > 0)
        const members = await api(
          `/rest/v1/couple_members?couple_id=eq.${coupleId}&select=user_id`,
          { token: a.access_token },
        )
        check('A 自动成为成员', Array.isArray(members) && members.length === 1)
      }
    } catch (err) {
      check('create_couple 返回 couple_id', false, String(err))
    }
  })

  // 3. A 查看邀请码
  let coupleId = null
  let inviteCode = null
  await run('3. 用户 A 查看邀请码', async () => {
    try {
      const couples = await api('/rest/v1/couples?select=id,invite_code&limit=5', {
        token: a.access_token,
      })
      const mine = Array.isArray(couples) ? couples[0] : null
      check('能查到自己的空间与邀请码', Boolean(mine && mine.invite_code))
      coupleId = mine?.id ?? null
      inviteCode = mine?.invite_code ?? null
    } catch (err) {
      check('能查到自己的空间与邀请码', false, String(err))
    }
  })

  // 4. B 加入空间
  await run('4. 用户 B 用邀请码加入', async () => {
    try {
      b = await signIn(cfg.TEST_USER_B_EMAIL, cfg.TEST_USER_B_PASSWORD)
      await api('/rest/v1/rpc/join_couple', {
        token: b.access_token,
        method: 'POST',
        body: { p_invite_code: inviteCode },
      })
      const members = await api(
        `/rest/v1/couple_members?couple_id=eq.${coupleId}&select=user_id`,
        { token: b.access_token },
      )
      check('B 加入成功且两人同空间', Array.isArray(members) && members.length === 2)
    } catch (err) {
      check('B 加入成功且两人同空间', false, String(err))
    }
  })

  // 5-6. A 创建事项，B 可见
  let taskId = null
  await run('5-6. A 创建数据，B 可查看', async () => {
    try {
      const [created] = await api('/rest/v1/tasks', {
        token: a.access_token,
        method: 'POST',
        prefer: 'return=representation',
        body: {
          couple_id: coupleId,
          title: 'W1 验证事项',
          category: '装修',
          status: 'not_started',
        },
      })
      taskId = created?.id ?? null
      check('A 创建事项成功', Boolean(taskId))
      const rows = await api(`/rest/v1/tasks?couple_id=eq.${coupleId}&select=id,title`, {
        token: b.access_token,
      })
      check('B 能看到该事项', Array.isArray(rows) && rows.length === 1 && rows[0].title === 'W1 验证事项')
    } catch (err) {
      check('A 创建事项成功', false, String(err))
    }
  })

  // 7-8. B 修改，A 刷新可见（含修改人）
  await run('7-8. B 修改数据，A 刷新可见', async () => {
    try {
      const bUser = await me(b.access_token)
      await api(`/rest/v1/tasks?id=eq.${taskId}`, {
        token: b.access_token,
        method: 'PATCH',
        body: { status: 'in_progress' },
      })
      const [row] = await api(`/rest/v1/tasks?id=eq.${taskId}&select=id,status,updated_by`, {
        token: a.access_token,
      })
      check(
        'A 刷新后看到 B 的修改',
        row?.status === 'in_progress' && row.updated_by === bUser.id,
        `status=${row?.status}, updated_by=${row?.updated_by}`,
      )
    } catch (err) {
      check('A 刷新后看到 B 的修改', false, String(err))
    }
  })

  // 9. 双空间隔离
  await run('9. 两个不同情侣空间互不可读', async () => {
    try {
      c = await signIn(cfg.TEST_USER_C_EMAIL, cfg.TEST_USER_C_PASSWORD)
      const cCouple = await api('/rest/v1/rpc/create_couple', {
        token: c.access_token,
        method: 'POST',
        body: { p_name: '隔离空间 C' },
      })
      await api('/rest/v1/tasks', {
        token: c.access_token,
        method: 'POST',
        body: {
          couple_id: cCouple,
          title: 'C 的私密事项',
          category: '其他',
          status: 'not_started',
        },
      })
      const aSeesCouple = await api(`/rest/v1/couples?select=id&id=eq.${cCouple}`, {
        token: a.access_token,
      })
      const bSeesCouple = await api(`/rest/v1/couples?select=id&id=eq.${cCouple}`, {
        token: b.access_token,
      })
      const aSeesTask = await api(`/rest/v1/tasks?select=id&couple_id=eq.${cCouple}`, {
        token: a.access_token,
      })
      check(
        'A/B 都看不到 C 的空间与数据',
        aSeesCouple.length === 0 &&
          bSeesCouple.length === 0 &&
          aSeesTask.length === 0,
      )
    } catch (err) {
      check('A/B 都看不到 C 的空间与数据', false, String(err))
    }
  })

  // 10. activity_logs 自动生成
  await run('10. activity_logs 自动生成', async () => {
    try {
      const aUser = await me(a.access_token)
      const bUser = await me(b.access_token)
      const logs = await api(
        `/rest/v1/activity_logs?couple_id=eq.${coupleId}&select=action,actor_id,entity_type,entity_id&order=created_at.asc`,
        { token: a.access_token },
      )
      const create = logs.find(
        (l) => l.entity_type === 'tasks' && l.entity_id === taskId && l.action === 'create' && l.actor_id === aUser.id,
      )
      const statusChange = logs.find(
        (l) => l.entity_type === 'tasks' && l.entity_id === taskId && l.action === 'status_change' && l.actor_id === bUser.id,
      )
      check('A 创建有 create 记录', Boolean(create))
      check('B 改状态有 status_change 记录', Boolean(statusChange))
    } catch (err) {
      check('activity_logs 记录', false, String(err))
    }
  })

  console.log(`\n===== 结果：通过 ${passed} 项，失败 ${failed} 项 =====`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
