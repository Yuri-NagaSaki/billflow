import type { Env } from '../types';
import { dbFirst, dbRun } from '../utils/db';
import { NotificationService } from './notificationService';

export interface SchedulerSettings {
  notification_check_time: string;
  timezone: string;
  is_enabled: number | boolean;
}

export class SchedulerService {
  private notificationService: NotificationService;

  constructor(private env: Env) {
    this.notificationService = new NotificationService(env);
  }

  async getSettings(): Promise<SchedulerSettings> {
    const result = await dbFirst<SchedulerSettings>(
      this.env.DB,
      'SELECT notification_check_time, timezone, is_enabled FROM scheduler_settings WHERE id = 1'
    );
    return (
      result || {
        notification_check_time: '09:00',
        timezone: 'Asia/Shanghai',
        is_enabled: 1
      }
    );
  }

  async updateSettings(settings: SchedulerSettings) {
    await dbRun(
      this.env.DB,
      'UPDATE scheduler_settings SET notification_check_time = ?, timezone = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [settings.notification_check_time, settings.timezone, settings.is_enabled ? 1 : 0]
    );
  }

  async triggerCheck() {
    return this.notificationService.checkAndSendNotifications();
  }

  async shouldRun(now: Date) {
    const settings = await this.getSettings();
    if (!settings.is_enabled) return false;

    const [hour, minute] = settings.notification_check_time.split(':').map(Number);
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: settings.timezone
    });
    const parts = formatter.formatToParts(now);
    const currentHour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    const currentMinute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
    return currentHour === hour && currentMinute === minute;
  }
}
