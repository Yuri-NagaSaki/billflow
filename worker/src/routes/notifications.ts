import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { NotificationService } from '../services/notificationService';
import { TelegramService } from '../services/telegramService';
import { createValidator, validateChannelConfig, validateSendNotification } from '../utils/validator';
import { handleQueryResult, validationError, error as errorResponse } from '../utils/response';
import { requireLogin } from '../middleware/requireLogin';
import { dbAll, dbFirst, dbRun } from '../utils/db';

export const notificationRoutes = new Hono<HonoEnv>();
export const protectedNotificationRoutes = new Hono<HonoEnv>();

notificationRoutes.get('/history', async (c) => {
  const service = new NotificationService(c.env);
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const status = c.req.query('status');
  const type = c.req.query('type');
  const result = await service.getNotificationHistory({ page, limit, status, type });
  return handleQueryResult(c, result, 'Notification history');
});

notificationRoutes.get('/stats', async (c) => {
  const service = new NotificationService(c.env);
  const stats = await service.getNotificationStats();
  return handleQueryResult(c, stats, 'Notification statistics');
});

protectedNotificationRoutes.use('*', requireLogin);

protectedNotificationRoutes.get('/settings', async (c) => {
  const settings = await dbAll<Record<string, unknown>>(
    c.env.DB,
    'SELECT * FROM notification_settings ORDER BY notification_type'
  );

  const parsed = settings.map((setting) => ({
    ...setting,
    notification_channels: JSON.parse(String(setting.notification_channels || '["telegram"]'))
  }));

  return handleQueryResult(c, parsed, 'Notification settings');
});

protectedNotificationRoutes.get('/settings/:type', async (c) => {
  const service = new NotificationService(c.env);
  const setting = await service.getNotificationSettings(c.req.param('type'));
  if (!setting) return errorResponse(c, 'Notification settings not found', 404);
  return handleQueryResult(c, setting, 'Notification settings');
});

protectedNotificationRoutes.put('/settings/:id', async (c) => {
  const settingId = Number(c.req.param('id'));
  const updateData = await c.req.json();

  const validator = createValidator();
  validator
    .boolean(updateData.is_enabled, 'is_enabled')
    .integer(updateData.advance_days, 'advance_days')
    .range(updateData.advance_days, 'advance_days', 0, 365)
    .array(updateData.notification_channels, 'notification_channels')
    .custom(
      updateData.notification_channels,
      'notification_channels',
      (channels) => !channels || channels.every((channel: string) => ['telegram'].includes(channel)),
      'notification_channels must contain only valid channel types: telegram'
    )
    .boolean(updateData.repeat_notification, 'repeat_notification');

  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const currentSetting = await dbFirst<{ notification_type: string }>(
    c.env.DB,
    'SELECT notification_type FROM notification_settings WHERE id = ?',
    [settingId]
  );

  if (!currentSetting) return errorResponse(c, 'Notification setting not found', 404);

  const normalizeBoolean = (value: unknown) => {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return value;
  };

  const normalizedIsEnabled = normalizeBoolean(updateData.is_enabled);
  const normalizedRepeat = normalizeBoolean(updateData.repeat_notification);
  const finalAdvanceDays = currentSetting.notification_type === 'expiration_warning' ? 0 : updateData.advance_days;

  const result = await dbRun(
    c.env.DB,
    `
      UPDATE notification_settings
      SET is_enabled = ?, advance_days = ?, notification_channels = ?, repeat_notification = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      normalizedIsEnabled ? 1 : 0,
      finalAdvanceDays,
      JSON.stringify(updateData.notification_channels || ['telegram']),
      normalizedRepeat ? 1 : 0,
      settingId
    ]
  );

  if ((result.meta?.changes || 0) === 0) return errorResponse(c, 'Notification setting not found', 404);
  return handleQueryResult(c, { message: 'Notification setting updated successfully' }, 'Notification setting');
});

protectedNotificationRoutes.post('/channels', async (c) => {
  const payload = await c.req.json();
  const validator = validateChannelConfig(payload);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new NotificationService(c.env);
  const result = await service.configureChannel(String(payload.channel_type), payload.config as Record<string, unknown>);
  if (result.success) return handleQueryResult(c, result, 'Channel configured');
  return errorResponse(c, result.error || 'Failed to configure channel', 400);
});

protectedNotificationRoutes.get('/channels/:channelType', async (c) => {
  const service = new NotificationService(c.env);
  const config = await service.getChannelConfig(c.req.param('channelType'));
  if (!config) return errorResponse(c, 'Channel configuration not found', 404);
  return handleQueryResult(c, config, 'Channel configuration');
});

protectedNotificationRoutes.post('/send', async (c) => {
  const payload = await c.req.json();
  const validator = validateSendNotification(payload);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new NotificationService(c.env);
  const result = await service.sendNotification({
    subscriptionId: payload.subscription_id,
    notificationType: payload.notification_type,
    channels: payload.channels
  });

  if (result.success) return handleQueryResult(c, result, 'Notification sent');
  return errorResponse(c, result.error || 'Failed to send notification', 400);
});

protectedNotificationRoutes.post('/test', async (c) => {
  const payload = await c.req.json();
  const validator = createValidator();
  validator.required(payload.channel_type, 'channel_type').string(payload.channel_type, 'channel_type').enum(payload.channel_type, 'channel_type', ['telegram']);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new NotificationService(c.env);
  const result = await service.testNotification(payload.channel_type);
  if (result.success) return handleQueryResult(c, result, 'Notification test');
  return errorResponse(c, result.error || 'Failed to send test notification', 400);
});

protectedNotificationRoutes.get('/history', async (c) => {
  const service = new NotificationService(c.env);
  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const status = c.req.query('status');
  const type = c.req.query('type');
  const result = await service.getNotificationHistory({ page, limit, status, type });
  return handleQueryResult(c, result, 'Notification history');
});

protectedNotificationRoutes.get('/stats', async (c) => {
  const service = new NotificationService(c.env);
  const stats = await service.getNotificationStats();
  return handleQueryResult(c, stats, 'Notification statistics');
});

protectedNotificationRoutes.post('/validate-chat-id', async (c) => {
  const payload = await c.req.json();
  const chatId = payload.chat_id;
  if (!chatId) return validationError(c, 'chat_id is required');
  const telegram = new TelegramService(c.env);
  const result = await telegram.validateChatId(String(chatId));
  if (result.success) return handleQueryResult(c, result, 'Chat id validation');
  return errorResponse(c, result.error || 'Invalid chat id', 400);
});

protectedNotificationRoutes.get('/telegram/bot-info', async (c) => {
  const telegram = new TelegramService(c.env);
  const result = await telegram.getBotInfo();
  if (result.success) return handleQueryResult(c, { success: true, botInfo: result.botInfo }, 'Bot info');
  return errorResponse(c, result.error || 'Failed to get bot info', 400);
});

protectedNotificationRoutes.get('/telegram/config-status', async (c) => {
  const telegram = new TelegramService(c.env);
  return handleQueryResult(c, telegram.getConfigStatus(), 'Telegram config status');
});
