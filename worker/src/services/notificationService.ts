import type { Env } from '../types';
import { getTemplate } from '../config/notificationTemplates';
import { DEFAULT_NOTIFICATION_CHANNELS, SUPPORTED_NOTIFICATION_TYPES } from '../config/notification';
import { TelegramService } from './telegramService';
import { getUserLanguage } from './userPreferenceService';
import { dbAll, dbFirst, dbRun, normalizeResult } from '../utils/db';

export class NotificationService {
  private telegramService: TelegramService;

  constructor(private env: Env) {
    this.telegramService = new TelegramService(env);
  }

  async sendNotification(data: { subscriptionId: number; notificationType: string; channels?: string[] | null }) {
    const { subscriptionId, notificationType, channels = null } = data;

    if (!SUPPORTED_NOTIFICATION_TYPES.includes(notificationType)) {
      return { success: false, message: 'Invalid notification type' };
    }

    const settings = await this.getNotificationSettings(notificationType);
    if (!settings || !settings.is_enabled) {
      return { success: false, message: 'Notification type disabled' };
    }

    const subscription = await this.getSubscriptionById(subscriptionId);
    if (!subscription) {
      return { success: false, message: 'Subscription not found' };
    }

    const targetChannels = channels || (await this.getEnabledChannels());

    const results = await Promise.all(
      targetChannels.map((channel) =>
        this.sendToChannel({ subscription, notificationType, channel, settings })
      )
    );

    return { success: true, results };
  }

  private async sendToChannel({
    subscription,
    notificationType,
    channel,
    settings
  }: {
    subscription: Record<string, unknown>;
    notificationType: string;
    channel: string;
    settings: Record<string, unknown>;
  }) {
    try {
      const channelConfig = await this.getChannelConfig(channel);
      if (!channelConfig || !channelConfig.is_active) {
        return { success: false, channel, message: 'Channel not configured' };
      }

      const userLanguage = await getUserLanguage(this.env);
      const { content: messageContent } = this.renderMessageTemplate({
        subscription,
        notificationType,
        channel,
        language: userLanguage
      });

      const recipient = this.getRecipient(channelConfig);
      const sendTime = new Date();

      let sendResult;
      if (channel === 'telegram') {
        sendResult = await this.telegramService.sendMessage(String(recipient), messageContent);
      } else {
        sendResult = { success: false, error: `Unsupported channel: ${channel}` };
      }

      await this.createNotificationRecord({
        subscriptionId: Number(subscription.id),
        notificationType,
        channelType: channel,
        recipient: String(recipient),
        messageContent,
        status: sendResult.success ? 'sent' : 'failed',
        sentAt: sendResult.success ? sendTime : null,
        errorMessage: sendResult.error || null
      });

      await this.updateChannelLastUsed(channel);

      return sendResult;
    } catch (error) {
      return { success: false, channel, error: (error as Error).message };
    }
  }

  async getNotificationSettings(notificationType: string) {
    return dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM notification_settings WHERE notification_type = ?',
      [notificationType]
    );
  }

  async getSubscriptionById(subscriptionId: number) {
    return dbFirst<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT s.*, c.label as category_label, pm.label as payment_method_label
        FROM subscriptions s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
        WHERE s.id = ?
      `,
      [subscriptionId]
    );
  }

  async getEnabledChannels() {
    const results = await dbAll<{ channel_type: string }>(
      this.env.DB,
      'SELECT channel_type FROM notification_channels WHERE is_active = 1'
    );

    if (!results.length) return DEFAULT_NOTIFICATION_CHANNELS;
    return results.map((row) => row.channel_type);
  }

  async getChannelConfig(channelType: string) {
    const result = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM notification_channels WHERE channel_type = ?',
      [channelType]
    );
    if (result) {
      try {
        result.config = JSON.parse(String(result.channel_config || '{}'));
      } catch {
        result.config = {};
      }
    }
    return result;
  }

  renderMessageTemplate({
    subscription,
    notificationType,
    channel,
    language = 'zh-CN'
  }: {
    subscription: Record<string, unknown>;
    notificationType: string;
    channel: string;
    language?: string;
  }) {
    const template = getTemplate(notificationType, language, channel);
    if (!template) {
      return {
        content: this.getDefaultContent(subscription, notificationType, language),
        subject: this.getDefaultSubject(subscription, notificationType, language)
      };
    }

    const templateData: Record<string, string> = {
      name: String(subscription.name || ''),
      plan: String(subscription.plan || ''),
      amount: String(subscription.amount || ''),
      currency: String(subscription.currency || ''),
      next_billing_date: this.formatDate(String(subscription.next_billing_date || ''), language),
      payment_method: String(subscription.payment_method_label || subscription.payment_method_id || ''),
      status: String(subscription.status || ''),
      billing_cycle: String(subscription.billing_cycle || '')
    };

    const replacePlaceholders = (input: string) => {
      let output = input;
      Object.keys(templateData).forEach((key) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        output = output.replace(regex, templateData[key] ?? '');
      });
      return output;
    };

    const content = replacePlaceholders(template.content_template || '');
    const subject = replacePlaceholders(template.subject_template || '') || this.getDefaultSubject(subscription, notificationType, language);

    return { content, subject };
  }

  getDefaultContent(subscription: Record<string, unknown>, notificationType: string, language = 'zh-CN') {
    const name = String(subscription.name || '');
    const amount = String(subscription.amount || '');
    const currency = String(subscription.currency || '');
    const date = this.formatDate(String(subscription.next_billing_date || ''), language);

    const typeMessages: Record<string, string> = {
      renewal_reminder: `续订提醒: ${name} 将在 ${date} 到期，金额: ${amount} ${currency}`,
      expiration_warning: `过期警告: ${name} 已在 ${date} 过期`,
      renewal_success: `续订成功: ${name} 续订成功，金额: ${amount} ${currency}`,
      renewal_failure: `续订失败: ${name} 续订失败，金额: ${amount} ${currency}`,
      subscription_change: `订阅变更: ${name} 信息已更新`
    };

    if (language.startsWith('en')) {
      const englishFallbacks: Record<string, string> = {
        renewal_reminder: `Renewal reminder: ${name} will renew on ${date}, amount: ${amount} ${currency}`,
        expiration_warning: `Expiration warning: ${name} expired on ${date}`,
        renewal_success: `Renewal success: ${name} renewed successfully, amount: ${amount} ${currency}`,
        renewal_failure: `Renewal failure: ${name} renewal failed, amount: ${amount} ${currency}`,
        subscription_change: `Subscription change: ${name} has been updated`
      };
      return englishFallbacks[notificationType] || `Subscription notification: ${name}`;
    }

    return typeMessages[notificationType] || `订阅通知: ${name}`;
  }

  getDefaultSubject(subscription: Record<string, unknown>, notificationType: string, language = 'zh-CN') {
    const name = String(subscription.name || '');
    const subjects: Record<string, string> = {
      renewal_reminder: language.startsWith('en') ? `Renewal Reminder - ${name}` : `续订提醒 - ${name}`,
      expiration_warning: language.startsWith('en') ? `Subscription Expired - ${name}` : `订阅已过期 - ${name}`,
      renewal_success: language.startsWith('en') ? `Renewal Successful - ${name}` : `续订成功 - ${name}`,
      renewal_failure: language.startsWith('en') ? `Renewal Failed - ${name}` : `续订失败 - ${name}`,
      subscription_change: language.startsWith('en') ? `Subscription Updated - ${name}` : `订阅变更通知 - ${name}`
    };

    return subjects[notificationType] || (language.startsWith('en') ? `Subscription Notification - ${name}` : `订阅通知 - ${name}`);
  }

  async createNotificationRecord(data: {
    subscriptionId: number;
    notificationType: string;
    channelType: string;
    recipient: string;
    messageContent: string;
    status: string;
    sentAt: Date | null;
    errorMessage?: string | null;
  }) {
    const result = await dbRun(
      this.env.DB,
      `
        INSERT INTO notification_history
        (subscription_id, notification_type, channel_type, status, recipient, message_content, sent_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.subscriptionId,
        data.notificationType,
        data.channelType,
        data.status,
        data.recipient,
        data.messageContent,
        data.sentAt ? data.sentAt.toISOString() : null,
        data.errorMessage || null
      ]
    );
    return normalizeResult(result);
  }

  async updateChannelLastUsed(channelType: string) {
    await dbRun(
      this.env.DB,
      'UPDATE notification_channels SET last_used_at = CURRENT_TIMESTAMP WHERE channel_type = ?',
      [channelType]
    );
  }

  getRecipient(channelConfig: Record<string, unknown>) {
    const config = channelConfig.config as Record<string, unknown> | undefined;
    if (config?.chat_id) return config.chat_id as string;
    return String(channelConfig.channel_config || '');
  }

  formatDate(dateString: string, language = 'zh-CN') {
    if (!dateString) {
      return language.startsWith('en') ? 'Unknown date' : '未知日期';
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString(language);
  }

  async configureChannel(channelType: string, config: Record<string, unknown>) {
    const configJson = JSON.stringify(config);
    const existing = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT id FROM notification_channels WHERE channel_type = ?',
      [channelType]
    );

    if (existing) {
      await dbRun(
        this.env.DB,
        'UPDATE notification_channels SET channel_config = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE channel_type = ?',
        [configJson, channelType]
      );
    } else {
      await dbRun(
        this.env.DB,
        'INSERT INTO notification_channels (channel_type, channel_config, is_active) VALUES (?, ?, 1)',
        [channelType, configJson]
      );
    }

    return { success: true, message: 'Channel configured successfully' };
  }

  async testNotification(channelType: string) {
    const channelConfig = await this.getChannelConfig(channelType);
    if (!channelConfig) return { success: false, message: 'Channel not configured' };

    if (channelType === 'telegram') {
      const chatId = this.getRecipient(channelConfig);
      return this.telegramService.sendTestMessage(String(chatId));
    }

    return { success: false, message: 'Unsupported channel type' };
  }

  async getNotificationHistory(options: { page?: number; limit?: number; status?: string; type?: string } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM notification_history nh
      LEFT JOIN subscriptions s ON nh.subscription_id = s.id
      WHERE 1=1
    `;

    const params: unknown[] = [];
    const countParams: unknown[] = [];

    if (options.status) {
      baseQuery += ' AND nh.status = ?';
      params.push(options.status);
      countParams.push(options.status);
    }

    if (options.type) {
      baseQuery += ' AND nh.notification_type = ?';
      params.push(options.type);
      countParams.push(options.type);
    }

    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await dbFirst<{ total: number }>(this.env.DB, countQuery, countParams);
    const total = countResult?.total || 0;

    const dataQuery = `
      SELECT nh.*, s.name as subscription_name
      ${baseQuery}
      ORDER BY nh.created_at DESC LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    const data = await dbAll<Record<string, unknown>>(this.env.DB, dataQuery, params);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getNotificationStats() {
    const total = await dbFirst<{ total: number }>(this.env.DB, 'SELECT COUNT(*) as total FROM notification_history');
    const sent = await dbFirst<{ total: number }>(this.env.DB, "SELECT COUNT(*) as total FROM notification_history WHERE status = 'sent'");
    const failed = await dbFirst<{ total: number }>(this.env.DB, "SELECT COUNT(*) as total FROM notification_history WHERE status = 'failed'");

    const byTypeRows = await dbAll<{ notification_type: string; count: number }>(
      this.env.DB,
      'SELECT notification_type, COUNT(*) as count FROM notification_history GROUP BY notification_type'
    );
    const byChannelRows = await dbAll<{ channel_type: string; count: number }>(
      this.env.DB,
      'SELECT channel_type, COUNT(*) as count FROM notification_history GROUP BY channel_type'
    );

    const byType: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    byTypeRows.forEach((row) => (byType[row.notification_type] = row.count));
    byChannelRows.forEach((row) => (byChannel[row.channel_type] = row.count));

    return {
      total: total?.total || 0,
      sent: sent?.total || 0,
      failed: failed?.total || 0,
      pending: 0,
      retrying: 0,
      byType,
      byChannel
    };
  }

  async checkAndSendNotifications() {
    const renewalNotifications = await this.getRenewalNotifications();
    for (const notification of renewalNotifications) {
      await this.sendNotification({
        subscriptionId: notification.id,
        notificationType: 'renewal_reminder',
        channels: JSON.parse(String(notification.notification_channels || '[\"telegram\"]'))
      });
    }

    const expirationNotifications = await this.getExpirationNotifications();
    for (const notification of expirationNotifications) {
      await this.sendNotification({
        subscriptionId: notification.id,
        notificationType: 'expiration_warning',
        channels: JSON.parse(String(notification.notification_channels || '[\"telegram\"]'))
      });
    }

    return {
      renewalCount: renewalNotifications.length,
      expirationCount: expirationNotifications.length
    };
  }

  private async getRenewalNotifications() {
    const query = `
      SELECT s.*, ns.advance_days, ns.notification_channels, ns.repeat_notification
      FROM subscriptions s
      CROSS JOIN notification_settings ns
      WHERE ns.notification_type = 'renewal_reminder'
        AND ns.is_enabled = 1
        AND s.status = 'active'
        AND s.next_billing_date BETWEEN date('now', '+1 day') AND date('now', '+' || ns.advance_days || ' days')
        AND (ns.repeat_notification = 1 OR NOT EXISTS (
          SELECT 1 FROM notification_history nh
          WHERE nh.subscription_id = s.id
          AND nh.notification_type = 'renewal_reminder'
          AND nh.status = 'sent'
          AND date(nh.created_at) >= date('now', '-' || ns.advance_days || ' days')
        ))
    `;

    return dbAll<Record<string, unknown>>(this.env.DB, query);
  }

  private async getExpirationNotifications() {
    const query = `
      SELECT s.*, ns.notification_channels
      FROM subscriptions s
      CROSS JOIN notification_settings ns
      WHERE ns.notification_type = 'expiration_warning'
        AND ns.is_enabled = 1
        AND s.status = 'active'
        AND s.next_billing_date = date('now', '-1 day')
        AND NOT EXISTS (
          SELECT 1 FROM notification_history nh
          WHERE nh.subscription_id = s.id
          AND nh.notification_type = 'expiration_warning'
          AND nh.status = 'sent'
          AND date(nh.created_at) = date('now')
        )
    `;

    return dbAll<Record<string, unknown>>(this.env.DB, query);
  }
}
