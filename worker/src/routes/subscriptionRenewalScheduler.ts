import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { SubscriptionManagementService } from '../services/subscriptionManagementService';
import { requireLogin } from '../middleware/requireLogin';
import { handleQueryResult } from '../utils/response';

export const subscriptionRenewalSchedulerRoutes = new Hono<HonoEnv>();
export const protectedSubscriptionRenewalSchedulerRoutes = new Hono<HonoEnv>();

subscriptionRenewalSchedulerRoutes.get('/status', async (c) => {
  return handleQueryResult(c, { isRunning: true, nextRun: null }, 'Subscription renewal scheduler status');
});

protectedSubscriptionRenewalSchedulerRoutes.use('*', requireLogin);

protectedSubscriptionRenewalSchedulerRoutes.post('/maintenance/run', async (c) => {
  const service = new SubscriptionManagementService(c.env);
  const autoRenewalResult = await service.processAutoRenewals();
  const expiredResult = await service.processExpiredSubscriptions();
  const totalProcessed = autoRenewalResult.processed + expiredResult.processed;
  const totalErrors = autoRenewalResult.errors + expiredResult.errors;

  return handleQueryResult(c, {
    success: true,
    autoRenewalResult,
    expiredResult,
    totalProcessed,
    totalErrors
  }, 'Maintenance run');
});
