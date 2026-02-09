## 通知系统说明（Cloudflare Workers）

### 概览
- 目标：为订阅管理提供到期提醒、过期警告、续订结果与订阅变更等通知
- 通知类型：
  - renewal_reminder（续订提醒）
  - expiration_warning（过期警告）
  - renewal_success（续订成功）
  - renewal_failure（续订失败）
  - subscription_change（订阅变更）
- 支持渠道：Telegram（无邮件）
- 多语言：zh-CN、en（根据用户偏好渲染模板）

### 主要组件
- `worker/src/services/notificationService.ts`
  - 统一发送入口（sendNotification）
  - 渲染模板（renderMessageTemplate）
  - 记录通知历史
- `worker/src/services/telegramService.ts`
  - 调用 Telegram Bot API 发送消息
- `worker/src/services/schedulerService.ts`
  - 读取通知调度设置，控制发送时机

### 配置与环境变量
- `TELEGRAM_BOT_TOKEN`：Telegram Bot Token（必需）

### 数据表（关键字段）
- `notification_settings`
  - notification_type / is_enabled / advance_days / repeat_notification / notification_channels
- `notification_channels`
  - channel_type: telegram
  - channel_config: `{"chat_id":"123456789"}`
- `notification_history`
  - 记录发送状态、内容与错误信息

### API 入口
- `GET /api/notifications/history`
- `GET /api/notifications/stats`
- `GET /api/protected/notifications/settings/:userId`
- `PUT /api/protected/notifications/settings/:id`
- `GET /api/protected/notifications/channels/telegram`
- `POST /api/protected/notifications/channels`
- `POST /api/protected/notifications/test`
- `POST /api/protected/notifications/send`

更多接口细节见 `docs/API_DOCUMENTATION.md`。
