# Billflow 后端架构（Cloudflare Workers）

## 概述

后端已重构为 Cloudflare Workers + Hono + D1 的无服务器架构，提供 RESTful API、会话认证、定时任务和 Telegram 通知。所有数据存储在 D1，前端通过 `/api` 访问同源 Worker 接口。

## 🏗 架构总览

```
Client (React)
  ↓
Cloudflare Worker (Hono)
  ├── Routes (API)
  ├── Services (业务逻辑)
  ├── D1 (数据持久化)
  └── Scheduled Triggers (Cron)
```

### 技术栈
- **运行时**: Cloudflare Workers
- **Web 框架**: Hono
- **数据库**: D1
- **会话认证**: D1 sessions + HttpOnly Cookie (`sid`)
- **密码哈希**: bcryptjs
- **定时任务**: Workers Cron Triggers
- **通知**: Telegram Bot API
- **汇率**: ExchangeRate-API

## 📁 目录结构

```
worker/
├── src/
│   ├── index.ts              # Worker 入口与路由挂载
│   ├── routes/               # API 路由
│   ├── services/             # 业务逻辑
│   ├── middleware/           # 会话与认证中间件
│   ├── utils/                # DB/校验/时间工具
│   └── types.ts              # Env/类型定义
migrations/
└── 0001_init.sql             # D1 初始化与默认数据
```

## 🔐 认证与会话
- 登录接口生成会话 ID，存入 D1 `sessions` 表。
- 会话 ID 通过 HttpOnly Cookie（`sid`）传递。
- 会话默认 12 小时过期，可通过环境变量调整 Cookie 行为。

## 🗄 数据存储（D1）
- 数据结构由 `migrations/0001_init.sql` 初始化。
- 包含订阅、支付历史、分类、支付方式、通知设置、会话等表。

## ⏱ 定时任务
通过 `wrangler.toml` 配置 Cron Trigger：
- `0 2 * * *`：更新汇率 + 处理自动续费/过期订阅
- `0 * * * *`：按调度设置检查并发送通知

## 🔔 通知系统
- 仅支持 Telegram 通知（无邮件）。
- 通知模板支持多语言（zh-CN/en）。
- 配置由 `notification_channels` 表管理。

## 🌍 汇率服务
- 使用 ExchangeRate-API 拉取汇率。
- 基础币种由 `BASE_CURRENCY` 控制。
- 通过 `/api/exchange-rates/config-status` 检查配置状态。

## 🔧 环境变量
关键配置见 README（`wrangler.toml` vars / `wrangler secret`）。

---

如需 API 细节，请参考 `docs/API_DOCUMENTATION.md`。
