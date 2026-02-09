# 认证与会话（Cloudflare Workers）

## 概述
- 登录基于管理员用户名/密码
- 会话存储在 D1 的 `sessions` 表
- 会话 ID 通过 HttpOnly Cookie（`sid`）传递
- 默认有效期 12 小时

## 认证流程
1. `POST /api/auth/login` 提交 `username` / `password`
2. Worker 创建会话并写入 Cookie
3. 访问 `/api/protected/*` 需携带 Cookie
4. `POST /api/auth/logout` 销毁会话

## 管理员账号初始化
- `ADMIN_USERNAME`：管理员用户名（默认 `admin`）
- `ADMIN_PASSWORD`：管理员明文密码（用于首次初始化）
- `ADMIN_PASSWORD_HASH`：推荐生产环境直接设置 bcrypt 哈希
- 若未配置以上字段，默认账号为 `admin` / `admin`

## Cookie 配置
- `SESSION_COOKIE_SECURE`：`true` / `false` / `auto`（默认 auto）
- `SESSION_COOKIE_SAMESITE`：`lax` / `strict` / `none`（默认 lax）

## 相关接口
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

更多 API 使用方式见 `docs/API_DOCUMENTATION.md`。
