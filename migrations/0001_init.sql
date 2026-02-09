-- D1 schema for Billflow
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  currency TEXT NOT NULL DEFAULT 'CNY',
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  show_original_currency BOOLEAN NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'zh-CN' CHECK (language IN ('zh-CN', 'en')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate DECIMAL(15, 8) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_currency, to_currency)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  plan TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'quarterly', 'semiannual')),
  next_billing_date DATE,
  last_billing_date DATE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  payment_method_id INTEGER NOT NULL,
  start_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'cancelled')),
  category_id INTEGER NOT NULL,
  renewal_type TEXT NOT NULL DEFAULT 'manual' CHECK (renewal_type IN ('auto', 'manual')),
  notes TEXT,
  website TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS payment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  payment_date DATE NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'failed', 'pending', 'cancelled', 'refunded')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monthly_category_summary (
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  total_amount_in_base_currency DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  base_currency TEXT NOT NULL DEFAULT 'CNY',
  transactions_count INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (year, month, category_id),
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_type TEXT NOT NULL UNIQUE CHECK (
    notification_type IN (
      'renewal_reminder', 'expiration_warning',
      'renewal_success', 'renewal_failure', 'subscription_change'
    )
  ),
  is_enabled BOOLEAN NOT NULL DEFAULT 1,
  advance_days INTEGER DEFAULT 7,
  repeat_notification BOOLEAN NOT NULL DEFAULT 0,
  notification_channels TEXT NOT NULL DEFAULT '["telegram"]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_type TEXT NOT NULL UNIQUE CHECK (channel_type IN ('telegram')),
  channel_config TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  notification_type TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  recipient TEXT NOT NULL,
  message_content TEXT NOT NULL,
  error_message TEXT,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scheduler_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  notification_check_time TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  is_enabled BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_category_id ON subscriptions(category_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_method_id ON subscriptions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_cycle ON subscriptions(billing_cycle);
CREATE INDEX IF NOT EXISTS idx_categories_value ON categories(value);
CREATE INDEX IF NOT EXISTS idx_payment_methods_value ON payment_methods(value);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_id ON payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_date ON payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_history_billing_period ON payment_history(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_monthly_category_summary_year_month ON monthly_category_summary(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_category_summary_category_id ON monthly_category_summary(category_id);
CREATE INDEX IF NOT EXISTS idx_monthly_category_summary_year_month_category ON monthly_category_summary(year, month, category_id);

INSERT OR IGNORE INTO settings (id, currency, theme, show_original_currency, language)
VALUES (1, 'CNY', 'system', 1, 'zh-CN');

INSERT OR IGNORE INTO categories (value, label) VALUES
('video', 'Video Streaming'),
('music', 'Music Streaming'),
('software', 'Software'),
('cloud', 'Cloud Storage'),
('news', 'News & Magazines'),
('game', 'Games'),
('productivity', 'Productivity'),
('education', 'Education'),
('finance', 'Finance'),
('other', 'Other');

INSERT OR IGNORE INTO payment_methods (value, label) VALUES
('creditcard', 'Credit Card'),
('debitcard', 'Debit Card'),
('paypal', 'PayPal'),
('applepay', 'Apple Pay'),
('googlepay', 'Google Pay'),
('banktransfer', 'Bank Transfer'),
('crypto', 'Cryptocurrency'),
('other', 'Other');

INSERT OR IGNORE INTO exchange_rates (from_currency, to_currency, rate) VALUES
('CNY', 'CNY', 1.0000),
('CNY', 'USD', 0.1538),
('CNY', 'EUR', 0.1308),
('CNY', 'GBP', 0.1154),
('CNY', 'CAD', 0.1923),
('CNY', 'AUD', 0.2077),
('CNY', 'JPY', 16.9231),
('CNY', 'TRY', 4.2000),
('CNY', 'HKD', 1.1923);

INSERT OR IGNORE INTO notification_settings (notification_type, is_enabled, advance_days, repeat_notification, notification_channels) VALUES
('renewal_reminder', 1, 7, 1, '["telegram"]'),
('expiration_warning', 1, 0, 0, '["telegram"]'),
('renewal_success', 1, 0, 0, '["telegram"]'),
('renewal_failure', 1, 0, 0, '["telegram"]'),
('subscription_change', 1, 0, 0, '["telegram"]');

INSERT OR IGNORE INTO scheduler_settings (id, notification_check_time, timezone, is_enabled)
VALUES (1, '09:00', 'Asia/Shanghai', 1);
