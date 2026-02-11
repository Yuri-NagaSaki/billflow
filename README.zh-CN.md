# Billflow

[English](README.md)

一个基于 **Cloudflare Workers** 重构优化的订阅管理系统，原始项目来自 [@huhusmang](https://github.com/huhusmang) 的 [Subscription-Management](https://github.com/huhusmang/Subscription-Management)。本项目在其基础上进行了 Cloudflare Workers + D1 架构重构，提供完整的 React 控制台、D1 数据存储、Telegram 通知与汇率自动更新能力。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yuri-NagaSaki/billflow)

## 界面预览

### 仪表盘 - 智能费用概览

<img width="3076" height="1494" alt="仪表盘" src="https://github.com/user-attachments/assets/25b51dd7-544d-49e0-bb9f-27d4249fda6c" />

*智能仪表盘，展示月/年费用统计、即将到期的订阅提醒及分类费用分析*

### 订阅管理

<img width="3122" height="1744" alt="订阅管理" src="https://github.com/user-attachments/assets/dba27af0-4b5e-4b92-a9ac-a22233c3f597" />

*完整的订阅生命周期管理，支持添加、编辑、状态管理和批量导入*

### 付款记录

<img width="3192" height="1598" alt="付款记录" src="https://github.com/user-attachments/assets/d6e1c4d7-eedf-48a8-9b2f-603bbfe6d66d" />

*完整的付款历史记录，支持搜索与订单增删改查*

### 月度支出 - 趋势分析

<img width="3128" height="1444" alt="月度支出" src="https://github.com/user-attachments/assets/6b1d21f3-d2c7-424e-937b-a5ee07a4dd29" />

*月度支出明细，直观展示消费详情*

### 费用报表 - 深度数据分析

<img width="3070" height="1690" alt="费用报表" src="https://github.com/user-attachments/assets/a61e5637-db34-47bd-83a8-4097e8fa805c" />

*强大的费用分析功能，包含趋势图表、分类统计和多维度数据展示*

## 功能特性

### 核心功能
- **订阅管理** — 添加、编辑、删除、追踪订阅服务
- **智能仪表盘** — 费用概览与即将到期续费提醒
- **分类与支付统计** — 按分类和支付方式进行费用统计
- **搜索与筛选** — 多维度搜索与状态筛选
- **自定义配置** — 自定义分类和支付方式

### 进阶功能
- **自动续费处理** — 智能检测到期订阅并自动更新
- **多币种支持** — 9 种货币实时转换（USD、EUR、GBP、CAD、AUD、JPY、CNY、TRY、HKD）
- **自动汇率更新** — 集成 ExchangeRate-API，通过 Cron Triggers 定时更新
- **费用分析报表** — 全面的费用分析与可视化图表
- **付款历史追踪** — 完整的付款记录与历史分析
- **数据导入/导出** — 支持 CSV 和 JSON 格式
- **主题切换** — 浅色 / 深色 / 跟随系统
- **国际化（i18n）** — 中文和英文
- **Telegram 通知** — 订阅到期与续费提醒
- **Cloudflare Workers + D1** — Serverless 部署，边缘 SQLite 存储

## 技术栈

### 前端
- React 19 + TypeScript
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

## 致谢

本项目基于 [@huhusmang](https://github.com/huhusmang) 的 [Subscription-Management](https://github.com/huhusmang/Subscription-Management) 重构而来。原项目提供了完整的订阅管理方案，采用 Docker 部署与本地 SQLite 存储。Billflow 在此基础上将架构重构为 **Cloudflare Workers + D1**，汇率服务替换为 **ExchangeRate-API**，并移除邮件通知改为 **Telegram** 单通道通知。感谢原作者的贡献。

## License

[MIT](LICENSE)
