import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { SchedulerService } from '../services/schedulerService';
import { handleQueryResult, validationError } from '../utils/response';
import { requireLogin } from '../middleware/requireLogin';

export const schedulerRoutes = new Hono<HonoEnv>();
export const protectedSchedulerRoutes = new Hono<HonoEnv>();

schedulerRoutes.get('/settings', async (c) => {
  const service = new SchedulerService(c.env);
  const settings = await service.getSettings();
  return handleQueryResult(c, settings, 'Scheduler settings');
});

schedulerRoutes.get('/status', async (c) => {
  const service = new SchedulerService(c.env);
  const settings = await service.getSettings();
  return handleQueryResult(c, {
    running: true,
    nextRun: null,
    settings,
    currentSchedule: {
      time: settings.notification_check_time,
      timezone: settings.timezone,
      enabled: Boolean(settings.is_enabled)
    }
  }, 'Scheduler status');
});

protectedSchedulerRoutes.use('*', requireLogin);

protectedSchedulerRoutes.put('/settings', async (c) => {
  const payload = await c.req.json();
  const { notification_check_time, timezone, is_enabled } = payload || {};
  if (!notification_check_time || !timezone || typeof is_enabled === 'undefined') {
    return validationError(c, 'notification_check_time, timezone, and is_enabled are required');
  }
  const service = new SchedulerService(c.env);
  await service.updateSettings({ notification_check_time, timezone, is_enabled });
  const updated = await service.getSettings();
  return c.json({ message: 'Scheduler settings updated', settings: updated });
});

protectedSchedulerRoutes.post('/trigger', async (c) => {
  const service = new SchedulerService(c.env);
  await service.triggerCheck();
  return c.json({ message: 'Notification check triggered' });
});
