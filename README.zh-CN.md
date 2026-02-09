# Billflow

[English](README.md)

一个基于 **Cloudflare Workers** 重构的订阅管理系统。提供完整的 React 控制台、D1 数据存储、Telegram 通知与汇率自动更新能力。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yuri-NagaSaki/billflow)

## 功能特性

- 订阅生命周期管理（自动/手动续费）
- 费用统计与可视化报表
- 多币种支持 + ExchangeRate-API 汇率更新
- Telegram 通知（不含邮件）
- 多语言（zh-CN、en）
- Cloudflare Workers + D1 部署

## 技术栈

### 前端
- React 18 + TypeScript
- Vite + Tailwind CSS + shadcn/ui
- Zustand + React Router
- Recharts + Radix UI
- React i18next

### 后端（Workers）
- Cloudflare Workers（Hono）
- D1（SQLite）
- Session 登录（D1 session 表）
- Telegram Bot API
- Cron 定时任务

## 一键部署（Cloudflare Workers）

模板部署注意事项：
- 需要先创建 D1 数据库，填写 `wrangler.toml` 里的 `database_id`，并执行迁移；否则无法登录。
- 若未设置 `ADMIN_PASSWORD`，默认账号/密码为 `admin` / `admin`（登录后请在设置中修改）。
- Telegram Bot Token 与 ExchangeRate-API Key 可在设置页面填写并存入 D1；环境变量可选。

1. 创建 D1 数据库：
   ```bash
   wrangler d1 create billflow
   ```

2. 将返回的 `database_id` 写入 `wrangler.toml`。

3. 数据库迁移：
   - Worker 会在首次请求时自动执行迁移。
   - 可选手动执行：
   ```bash
   wrangler d1 migrations apply billflow --local
   wrangler d1 migrations apply billflow
   ```

4. 配置密钥（可选）：
   ```bash
   wrangler secret put ADMIN_PASSWORD
   ```

5. 构建并部署：
   ```bash
   pnpm install
   pnpm run build
   wrangler deploy
   ```

## GitHub Actions 部署（Fork）

1. Fork 本仓库。
2. 创建 D1 数据库，记录 **name** 与 **ID**。
3. 在你的 fork 仓库里添加 GitHub Secrets：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `D1_DATABASE_ID`
   - `D1_DATABASE_NAME`
   - `ADMIN_PASSWORD`
   - `WORKER_NAME`（可选）
4. 推送到 `main` 或手动触发工作流。

该工作流会自动执行 D1 迁移并部署 Worker。

## 本地开发

1. 安装依赖：
   ```bash
   pnpm install
   ```

2. 本地迁移：
   ```bash
   wrangler d1 migrations apply billflow --local
   ```

3. 启动 Workers：
   ```bash
   pnpm run dev:worker
   ```

4. 启动前端（另一个终端）：
   ```bash
   pnpm run dev
   ```

前端地址：http://localhost:5173
Worker API：http://127.0.0.1:8787/api

## 环境变量

- `ADMIN_USERNAME`（可选，默认 `admin`）
- `ADMIN_PASSWORD`（初始登录必填）
- `ADMIN_PASSWORD_HASH`（可选，覆盖 `ADMIN_PASSWORD`）
- `SESSION_COOKIE_SECURE`（可选，`true`/`false`/`auto`）
- `SESSION_COOKIE_SAMESITE`（可选，`lax`/`strict`/`none`）
- `BASE_CURRENCY`（可选，默认 `CNY`）
- `TELEGRAM_BOT_TOKEN`（可选，也可在设置页面填写）
- `EXCHANGE_RATE_API_KEY`（可选，也可在设置页面填写）

## 测试

运行 Worker 测试：
```bash
pnpm run test
```

## License

MIT
