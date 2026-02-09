import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { SubscriptionService } from '../services/subscriptionService';
import { SubscriptionManagementService } from '../services/subscriptionManagementService';
import { createValidator, validateSubscriptionWithForeignKeys } from '../utils/validator';
import { handleDbResult, handleQueryResult, validationError, success, error as errorResponse } from '../utils/response';
import { requireLogin } from '../middleware/requireLogin';

export const subscriptionRoutes = new Hono<HonoEnv>();
export const protectedSubscriptionRoutes = new Hono<HonoEnv>();

subscriptionRoutes.get('/', async (c) => {
  const service = new SubscriptionService(c.env);
  const subscriptions = await service.getAllSubscriptions();
  return handleQueryResult(c, subscriptions, 'Subscriptions');
});

subscriptionRoutes.get('/stats/overview', async (c) => {
  const service = new SubscriptionService(c.env);
  const stats = await service.getSubscriptionStats();
  return handleQueryResult(c, stats, 'Subscription statistics');
});

subscriptionRoutes.get('/stats/upcoming-renewals', async (c) => {
  const days = Number(c.req.query('days') || '7');
  const service = new SubscriptionService(c.env);
  const upcoming = await service.getUpcomingRenewals(days);
  return handleQueryResult(c, upcoming, 'Upcoming renewals');
});

subscriptionRoutes.get('/stats/expired', async (c) => {
  const service = new SubscriptionService(c.env);
  const expired = await service.getExpiredSubscriptions();
  return handleQueryResult(c, expired, 'Expired subscriptions');
});

subscriptionRoutes.get('/category/:category', async (c) => {
  const service = new SubscriptionService(c.env);
  const subs = await service.getSubscriptionsByCategory(c.req.param('category'));
  return handleQueryResult(c, subs, 'Subscriptions by category');
});

subscriptionRoutes.get('/status/:status', async (c) => {
  const service = new SubscriptionService(c.env);
  const subs = await service.getSubscriptionsByStatus(c.req.param('status'));
  return handleQueryResult(c, subs, 'Subscriptions by status');
});

subscriptionRoutes.get('/search', async (c) => {
  const query = c.req.query('q');
  if (!query) return validationError(c, 'Search query is required');
  const service = new SubscriptionService(c.env);
  const subs = await service.searchSubscriptions(query);
  return handleQueryResult(c, subs, 'Search results');
});

subscriptionRoutes.get('/:id/payment-history', async (c) => {
  const service = new SubscriptionService(c.env);
  const history = await service.getSubscriptionPaymentHistory(Number(c.req.param('id')));
  return handleQueryResult(c, history, 'Payment history');
});

subscriptionRoutes.get('/:id', async (c) => {
  const service = new SubscriptionService(c.env);
  const subscription = await service.getSubscriptionById(Number(c.req.param('id')));
  return handleQueryResult(c, subscription, 'Subscription');
});

protectedSubscriptionRoutes.use('*', requireLogin);

protectedSubscriptionRoutes.post('/', async (c) => {
  const payload = await c.req.json();
  const validator = await validateSubscriptionWithForeignKeys(c.env, c.env.DB, payload);
  if (validator.hasErrors()) {
    return validationError(c, validator.getErrors());
  }
  const service = new SubscriptionService(c.env);
  const result = await service.createSubscription(payload);
  return handleDbResult(c, result, 'create', 'Subscription');
});

protectedSubscriptionRoutes.post('/bulk', async (c) => {
  const payload = await c.req.json();
  if (!Array.isArray(payload)) {
    return validationError(c, 'Request body must be an array of subscriptions');
  }

  for (let i = 0; i < payload.length; i += 1) {
    const validator = await validateSubscriptionWithForeignKeys(c.env, c.env.DB, payload[i]);
    if (validator.hasErrors()) {
      return validationError(c, `Subscription ${i + 1}: ${validator.getErrors().map((e) => e.message).join(', ')}`);
    }
  }

  const service = new SubscriptionService(c.env);
  const result = await service.bulkCreateSubscriptions(payload);
  return handleQueryResult(c, result, 'Subscriptions');
});

protectedSubscriptionRoutes.put('/:id', async (c) => {
  const payload = await c.req.json();
  const validator = await validateSubscriptionWithForeignKeys(c.env, c.env.DB, payload);
  validator.errors = validator.errors.filter((error) => !error.message.includes('is required'));
  if (validator.hasErrors()) {
    return validationError(c, validator.getErrors());
  }

  const service = new SubscriptionService(c.env);
  const result = await service.updateSubscription(Number(c.req.param('id')), payload);
  return handleDbResult(c, result, 'update', 'Subscription');
});

protectedSubscriptionRoutes.delete('/:id', async (c) => {
  const service = new SubscriptionService(c.env);
  const result = await service.deleteSubscription(Number(c.req.param('id')));
  return handleDbResult(c, result, 'delete', 'Subscription');
});

protectedSubscriptionRoutes.post('/reset', async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  if (payload?.confirm !== 'DELETE_ALL_SUBSCRIPTIONS') {
    return validationError(c, 'To confirm deletion, include "confirm": "DELETE_ALL_SUBSCRIPTIONS" in request body');
  }
  const service = new SubscriptionManagementService(c.env);
  const result = await service.resetAllSubscriptions();
  return success(c, result, result.message);
});

protectedSubscriptionRoutes.post('/auto-renew', async (c) => {
  const service = new SubscriptionManagementService(c.env);
  const result = await service.processAutoRenewals();
  return success(c, result, result.message);
});

protectedSubscriptionRoutes.post('/process-expired', async (c) => {
  const service = new SubscriptionManagementService(c.env);
  const result = await service.processExpiredSubscriptions();
  return success(c, result, result.message);
});

protectedSubscriptionRoutes.post('/:id/manual-renew', async (c) => {
  const id = c.req.param('id');
  const validator = createValidator();
  validator.required(id, 'id').integer(id, 'id').range(id, 'id', 1);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new SubscriptionManagementService(c.env);
  try {
    const result = await service.manualRenewSubscription(Number(id));
    return success(c, result, result.message);
  } catch (error) {
    return errorResponse(c, (error as Error).message, 400);
  }
});

protectedSubscriptionRoutes.post('/:id/reactivate', async (c) => {
  const id = c.req.param('id');
  const validator = createValidator();
  validator.required(id, 'id').integer(id, 'id').range(id, 'id', 1);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new SubscriptionManagementService(c.env);
  try {
    const result = await service.reactivateSubscription(Number(id));
    return success(c, result, result.message);
  } catch (error) {
    return errorResponse(c, (error as Error).message, 400);
  }
});

protectedSubscriptionRoutes.post('/batch-process', async (c) => {
  const service = new SubscriptionManagementService(c.env);
  const payload = await c.req.json();
  const {
    processAutoRenewals = false,
    processExpired = false,
    dryRun = false
  } = payload || {};

  const validator = createValidator();
  validator
    .boolean(processAutoRenewals, 'processAutoRenewals')
    .boolean(processExpired, 'processExpired')
    .boolean(dryRun, 'dryRun');

  if (validator.hasErrors()) return validationError(c, validator.getErrors());
  if (!processAutoRenewals && !processExpired) {
    return validationError(c, 'At least one of processAutoRenewals or processExpired must be true');
  }

  const results: Record<string, unknown> = {
    dryRun,
    autoRenewals: null,
    expiredSubscriptions: null,
    summary: {
      totalProcessed: 0,
      totalErrors: 0
    }
  };

  if (dryRun) {
    if (processAutoRenewals) {
      results.autoRenewals = { willProcess: 'Use actual service to get count' };
    }
    if (processExpired) {
      results.expiredSubscriptions = { willProcess: 'Use actual service to get count' };
    }
    return success(c, results, 'Dry run completed - no actual changes made');
  }

  if (processAutoRenewals) {
    const autoRenewals = await service.processAutoRenewals();
    results.autoRenewals = autoRenewals;
    (results.summary as { totalProcessed: number; totalErrors: number }).totalProcessed += autoRenewals.processed;
    (results.summary as { totalProcessed: number; totalErrors: number }).totalErrors += autoRenewals.errors;
  }

  if (processExpired) {
    const expiredSubscriptions = await service.processExpiredSubscriptions();
    results.expiredSubscriptions = expiredSubscriptions;
    (results.summary as { totalProcessed: number; totalErrors: number }).totalProcessed += expiredSubscriptions.processed;
    (results.summary as { totalProcessed: number; totalErrors: number }).totalErrors += expiredSubscriptions.errors;
  }

  return success(
    c,
    results,
    `Batch processing completed: ${(results.summary as { totalProcessed: number }).totalProcessed} processed, ${(results.summary as { totalErrors: number }).totalErrors} errors`
  );
});

protectedSubscriptionRoutes.get('/stats', async (c) => {
  const service = new SubscriptionManagementService(c.env);
  const stats = await service.getSubscriptionManagementStats();
  return handleQueryResult(c, stats, 'Subscription management statistics');
});

protectedSubscriptionRoutes.get('/upcoming-renewals', async (c) => {
  const days = Number(c.req.query('days') || '7');
  const validator = createValidator();
  validator.integer(days, 'days').range(days, 'days', 1, 365);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());
  const service = new SubscriptionManagementService(c.env);
  const upcoming = await service.previewUpcomingRenewals(days);
  return handleQueryResult(c, upcoming, 'Upcoming renewals preview');
});
