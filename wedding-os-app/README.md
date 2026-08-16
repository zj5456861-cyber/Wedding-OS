# Wedding OS App (v0.3)

私人双人 Wedding OS 前端。React 19 + Vite + TypeScript + PWA + Supabase + React Router + TanStack Query。

当前进度：W1-W4 已验收通过；W5（豆包 AI 助手 + 双人成员体系）已实现，待运行迁移 0009 与部署 Edge Function 后线上验证。
决策中心已按实际使用场景移除（重要决定线下沟通），事项系统作为执行管理工具保留；
附件/AI/复杂通知不做（未来版本再评估）。
AI 助手（W5 豆包）已做架构预留：首页悬浮入口 + 只读 AI Context Service + 规划文档（docs/AI-assistant-plan.md）。

## W5 部署（Edge Function）

1. 运行迁移 `0009_ai_suggestions.sql`（Supabase Dashboard → SQL Editor）
2. 部署函数并配置密钥（需要 Supabase CLI）：

```bash
cd supabase
supabase login
supabase link --project-ref jpzfwgpbhxigzpxfpynw
supabase functions deploy ai-assistant
supabase secrets set DOUBAO_API_KEY=你的豆包APIKey DOUBAO_MODEL=你的模型ID
```

> API Key 只存服务端环境变量；AI 只读、只经 Context Service 获取数据；
> AI 生成的事项草稿必须用户确认后才由前端写入。
页面只做"能用"的功能布局，不做 UI 美化。

## 开发

1. 复制 `.env.example` 为 `.env`，填入 Supabase Project URL 与 anon key
2. `pnpm install`
3. `pnpm dev`（`--host` 已开启，手机与电脑同一局域网可访问）

当前 `.env` 已写入本项目 Supabase 配置：

```env
VITE_SUPABASE_URL=https://jpzfwgpbhxigzpxfpynw.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_OKkmQRpOtxv-Pz5jUHbTug_UaStNrJ6
```

> 注意：URL 需去掉 `/rest/v1/` 后缀；anon key 为公开可发布的 publishable key。

## 路由（三组）

- `/auth` — 登录 / 注册
- `/space` — 创建空间 / 邀请码加入（无空间用户强制进入）
- `/` — 主界面（底部 5 Tab 空壳：首页/时间轴/事项/决策/我的）

会话持久化：`persistSession + autoRefreshToken`，刷新不退出。

## 验证脚本

```bash
pnpm verify:w1
```

前提：`.env` 中配置 A/B/C 三个测试账号（若 Supabase 开启邮箱确认，需先完成确认）。
脚本只使用 anon key，全部数据访问依赖 RLS，不使用 service_role。

验证内容：

1. A 登录并创建空间
2. A 获取邀请码
3. B 用邀请码加入
4. A 创建事项 → B 可见
5. B 修改事项 → A 刷新可见（含修改人）
6. 第三账号 C 建第二个空间 → A/B 均不可读 C 的数据
7. activity_logs 自动生成 create / status_change 记录

## 目录

```
src/
  lib/       supabase 客户端、couple 数据操作
  pages/     登录 / 空间 / 主框架（5 Tab）
scripts/    verify-w1.mjs（W1 验收脚本）
```
