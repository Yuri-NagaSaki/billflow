# 部署指南（Cloudflare Workers）

## 1. 前置条件
- Node.js 18+
- Cloudflare 账号与 Wrangler CLI

## 2. 安装依赖
```bash
pnpm install
```

## 3. 配置 D1 数据库
```bash
wrangler d1 create billflow
```
将输出的 `database_id` 更新到 `wrangler.toml`：
```
[[d1_databases]]
binding = "DB"
database_name = "billflow"
database_id = "<your-d1-id>"
```

初始化数据库：
```bash
wrangler d1 execute billflow --file=./migrations/0001_init.sql
```

## 4. 配置环境变量
在 `wrangler.toml` 的 `vars` 中添加，或使用 `wrangler secret`：
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` 或 `ADMIN_PASSWORD_HASH`
- `BASE_CURRENCY`
- `EXCHANGE_RATE_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `SESSION_COOKIE_SECURE` / `SESSION_COOKIE_SAMESITE`（可选）

## 5. 构建并部署
```bash
pnpm run build
wrangler deploy
```

## 6. 本地开发
- 前端：`pnpm run dev`
- Worker：`pnpm run dev:worker`

默认 Worker 地址：`http://127.0.0.1:8787`
