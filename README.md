# Billflow

[简体中文](README.zh-CN.md)

A modern subscription management system rebuilt for **Cloudflare Workers**, based on [Subscription-Management](https://github.com/huhusmang/Subscription-Management) by [@huhusmang](https://github.com/huhusmang). This project is a refactored and optimized version running on Cloudflare Workers + D1, with a full React dashboard, Telegram notifications, and automated exchange rate updates.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yuri-NagaSaki/billflow)

## Screenshots

### Dashboard - Smart Expense Overview
![Dashboard](docs/images/dashboard.png)
*Smart dashboard displaying monthly/yearly expense statistics, upcoming subscription reminders, and categorized expense analysis*

### Subscription Management
![Subscription Management](docs/images/subscriptions.png)
*Complete subscription lifecycle management with support for adding, editing, status management, and batch import*

### Payment History
![Payment History](docs/images/subscriptions-payments.png)
*Complete payment history records with search support and CRUD operations*

### Monthly Expenses - Trend Analysis
![Monthly Expenses](docs/images/monthly-expense.png)
*Monthly expense breakdown with intuitive display of spending details*

### Expense Reports - In-depth Data Analysis
![Expense Reports](docs/images/reports.png)
*Powerful expense analysis with trend charts, category statistics, and multi-dimensional data display*

### Dark Theme
![Dark Theme Reports](docs/images/reports-dark.png)
*Full dark theme support across all pages*

## Features

### Core
- **Subscription Management** — Add, edit, delete, and track subscription services
- **Smart Dashboard** — Expense overview with upcoming renewal reminders
- **Category & Payment Statistics** — Expense breakdown by category and payment method
- **Search & Filter** — Multi-dimensional search and status filtering
- **Custom Configuration** — Custom categories and payment methods

### Advanced
- **Automatic Renewal Processing** — Detect expiring subscriptions and auto-update
- **Multi-currency Support** — Real-time conversion for 9 currencies (USD, EUR, GBP, CAD, AUD, JPY, CNY, TRY, HKD)
- **Automatic Exchange Rates** — ExchangeRate-API integration with scheduled updates via Cron Triggers
- **Expense Reports** — Comprehensive expense analysis and visualization
- **Payment History Tracking** — Complete payment records and historical analysis
- **Data Import/Export** — CSV and JSON format support
- **Theme Switching** — Light / Dark / System themes
- **Internationalization (i18n)** — English and Chinese
- **Telegram Notifications** — Subscription expiry and renewal reminders
- **Cloudflare Workers + D1** — Serverless deployment with edge-based SQLite storage

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite + Tailwind CSS + shadcn/ui
- Zustand + React Router
- Recharts + Radix UI
- React i18next

### Backend (Workers)
- Cloudflare Workers (Hono)
- D1 (SQLite)
- Session-based auth (D1 session table)
- Telegram Bot API
- Cron triggers for scheduled tasks


## GitHub Actions Deploy (Fork)

1. Fork this repository.
2. Create a D1 database and note the **name** + **ID**.
3. In your fork, add GitHub Secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `D1_DATABASE_ID`
   - `D1_DATABASE_NAME`
   - `ADMIN_PASSWORD`
   - `WORKER_NAME` (optional)
4. Push to `main` or run the workflow manually.

The workflow auto-applies D1 migrations and deploys the Worker.

## Acknowledgments

This project is based on [Subscription-Management](https://github.com/huhusmang/Subscription-Management) by [@huhusmang](https://github.com/huhusmang). Thanks for the original work.

## License

MIT
