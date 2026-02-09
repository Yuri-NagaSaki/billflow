import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
import type { HonoEnv } from './types';
import { authRoutes } from './routes/auth';
import { subscriptionRoutes, protectedSubscriptionRoutes } from './routes/subscriptions';
import { analyticsRoutes } from './routes/analytics';
import { settingsRoutes, protectedSettingsRoutes } from './routes/settings';
import { exchangeRateRoutes, protectedExchangeRateRoutes } from './routes/exchangeRates';
import { paymentHistoryRoutes, protectedPaymentHistoryRoutes } from './routes/paymentHistory';
import { categoriesRoutes, protectedCategoriesRoutes, paymentMethodsRoutes, protectedPaymentMethodsRoutes } from './routes/categories';
import { monthlyCategorySummaryRoutes, protectedMonthlyCategorySummaryRoutes } from './routes/monthlyCategorySummary';
import { notificationRoutes, protectedNotificationRoutes } from './routes/notifications';
import { schedulerRoutes, protectedSchedulerRoutes } from './routes/scheduler';
import { userPreferencesRoutes } from './routes/userPreferences';
import { templateRoutes } from './routes/templates';
import { subscriptionRenewalSchedulerRoutes, protectedSubscriptionRenewalSchedulerRoutes } from './routes/subscriptionRenewalScheduler';
import { updateExchangeRates } from './services/exchangeRateService';
import { SubscriptionManagementService } from './services/subscriptionManagementService';
import { SchedulerService } from './services/schedulerService';
import { NotificationService } from './services/notificationService';
import { ensureAdminUser } from './services/adminUserService';
import { requireLogin } from './middleware/requireLogin';

const app = new Hono<HonoEnv>();

app.use('*', cors({ origin: '*', credentials: true }));

app.use('*', async (c, next) => {
  await ensureAdminUser(c.env);
  await next();
});

app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth')) {
    await next();
    return;
  }
  return requireLogin(c, next);
});

app.route('/api/auth', authRoutes);

app.route('/api/subscriptions', subscriptionRoutes);
app.route('/api/protected/subscriptions', protectedSubscriptionRoutes);

app.route('/api/analytics', analyticsRoutes);

app.route('/api/settings', settingsRoutes);
app.route('/api/protected/settings', protectedSettingsRoutes);

app.route('/api/exchange-rates', exchangeRateRoutes);
app.route('/api/protected/exchange-rates', protectedExchangeRateRoutes);

app.route('/api/payment-history', paymentHistoryRoutes);
app.route('/api/protected/payment-history', protectedPaymentHistoryRoutes);

app.route('/api/categories', categoriesRoutes);
app.route('/api/protected/categories', protectedCategoriesRoutes);

app.route('/api/payment-methods', paymentMethodsRoutes);
app.route('/api/protected/payment-methods', protectedPaymentMethodsRoutes);

app.route('/api/monthly-category-summary', monthlyCategorySummaryRoutes);
app.route('/api/protected/monthly-category-summary', protectedMonthlyCategorySummaryRoutes);

app.route('/api/notifications', notificationRoutes);
app.route('/api/protected/notifications', protectedNotificationRoutes);

app.route('/api/scheduler', schedulerRoutes);
app.route('/api/protected/scheduler', protectedSchedulerRoutes);

app.route('/api/subscription-renewal-scheduler', subscriptionRenewalSchedulerRoutes);
app.route('/api/protected/subscription-renewal-scheduler', protectedSubscriptionRenewalSchedulerRoutes);

app.route('/api/user-preferences', userPreferencesRoutes);
app.route('/api/templates', templateRoutes);

app.get('/api/health', (c) => c.json({ message: 'Billflow Worker is running!', status: 'healthy' }));

app.notFound(async (c) => {
  if (c.req.path.startsWith('/api')) {
    return c.json({ error: 'Not Found', status: 404 }, 404);
  }

  if (c.env.ASSETS) {
    const assetUrl = new URL(c.req.url);
    const assetResponse = await c.env.ASSETS.fetch(new Request(assetUrl.toString(), c.req.raw));
    if (assetResponse.status !== 404) {
      return assetResponse;
    }
    assetUrl.pathname = '/index.html';
    return c.env.ASSETS.fetch(new Request(assetUrl.toString(), c.req.raw));
  }

  return c.text('Frontend not found', 404);
});

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: HonoEnv['Bindings'], ctx: ExecutionContext) => {
    if (event.cron === '0 2 * * *') {
      ctx.waitUntil(updateExchangeRates(env));
      const managementService = new SubscriptionManagementService(env);
      ctx.waitUntil(managementService.processAutoRenewals());
      ctx.waitUntil(managementService.processExpiredSubscriptions());
      return;
    }

    if (event.cron === '0 * * * *') {
      const scheduler = new SchedulerService(env);
      const shouldRun = await scheduler.shouldRun(new Date());
      if (shouldRun) {
        const notificationService = new NotificationService(env);
        ctx.waitUntil(notificationService.checkAndSendNotifications());
      }
      return;
    }
  }
};
