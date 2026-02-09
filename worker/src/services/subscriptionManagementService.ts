import type { Env } from '../types';
import { dbAll, dbFirst, dbRun, normalizeResult } from '../utils/db';
import { calculateNextBillingDate, getTodayString, isDateDueOrOverdue } from '../utils/dateUtils';
import { NotificationService } from './notificationService';

export class SubscriptionManagementService {
  private notificationService: NotificationService;

  constructor(private env: Env) {
    this.notificationService = new NotificationService(env);
  }

  async count(filters: Record<string, unknown>) {
    let query = 'SELECT COUNT(*) as count FROM subscriptions';
    const params: unknown[] = [];
    const conditions: string[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (conditions.length) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await dbFirst<{ count: number }>(this.env.DB, query, params);
    return result?.count || 0;
  }

  async processAutoRenewals() {
    const subscriptions = await dbAll<Record<string, unknown>>(
      this.env.DB,
      "SELECT * FROM subscriptions WHERE status = 'active' AND renewal_type = 'auto'"
    );

    let processed = 0;
    let errors = 0;
    const renewedSubscriptions: Array<Record<string, unknown>> = [];

    for (const subscription of subscriptions) {
      try {
        if (isDateDueOrOverdue(String(subscription.next_billing_date))) {
          const renewalResult = await this.renewSubscription(subscription, 'auto');
          if (renewalResult.success) {
            processed++;
            renewedSubscriptions.push(renewalResult.data);
          } else {
            errors++;
            this.notificationService
              .sendNotification({ subscriptionId: Number(subscription.id), notificationType: 'renewal_failure' })
              .catch(() => undefined);
          }
        }
      } catch {
        errors++;
      }
    }

    return {
      message: `Auto renewal complete: ${processed} processed, ${errors} errors`,
      processed,
      errors,
      renewedSubscriptions
    };
  }

  async processExpiredSubscriptions() {
    const subscriptions = await dbAll<Record<string, unknown>>(
      this.env.DB,
      "SELECT * FROM subscriptions WHERE status = 'active' AND renewal_type = 'manual'"
    );

    let processed = 0;
    let errors = 0;
    const expiredSubscriptions: Array<Record<string, unknown>> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const subscription of subscriptions) {
      try {
        const billingDate = new Date(String(subscription.next_billing_date));
        billingDate.setHours(0, 0, 0, 0);
        if (billingDate < today) {
          const result = await dbRun(
            this.env.DB,
            'UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?',
            ['cancelled', new Date().toISOString(), subscription.id]
          );
          if ((result.meta?.changes || 0) > 0) {
            processed++;
            expiredSubscriptions.push({
              id: subscription.id,
              name: subscription.name,
              expiredDate: subscription.next_billing_date
            });
          } else {
            errors++;
          }
        }
      } catch {
        errors++;
      }
    }

    return {
      message: `Expired subscriptions processed: ${processed} expired, ${errors} errors`,
      processed,
      errors,
      expiredSubscriptions
    };
  }

  async manualRenewSubscription(subscriptionId: number) {
    const subscription = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM subscriptions WHERE id = ?',
      [subscriptionId]
    );
    if (!subscription) throw new Error('Subscription not found');

    if (subscription.renewal_type !== 'manual') {
      throw new Error('Only manual renewal subscriptions can be manually renewed');
    }

    const renewalResult = await this.renewSubscription(subscription, 'manual');
    if (renewalResult.success) {
      return { message: 'Subscription renewed successfully', renewalData: renewalResult.data };
    }

    this.notificationService
      .sendNotification({ subscriptionId: Number(subscription.id), notificationType: 'renewal_failure' })
      .catch(() => undefined);

    throw new Error('Failed to update subscription');
  }

  async reactivateSubscription(subscriptionId: number) {
    const subscription = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM subscriptions WHERE id = ?',
      [subscriptionId]
    );
    if (!subscription) throw new Error('Subscription not found');

    if (subscription.status !== 'cancelled') {
      throw new Error('Only cancelled subscriptions can be reactivated');
    }

    const todayStr = getTodayString();
    const newNextBillingStr = calculateNextBillingDate(todayStr, String(subscription.billing_cycle));

    const result = await dbRun(
      this.env.DB,
      'UPDATE subscriptions SET last_billing_date = ?, next_billing_date = ?, status = ?, updated_at = ? WHERE id = ?',
      [todayStr, newNextBillingStr, 'active', new Date().toISOString(), subscriptionId]
    );

    if ((result.meta?.changes || 0) > 0) {
      await dbRun(
        this.env.DB,
        `
          INSERT INTO payment_history (subscription_id, payment_date, amount_paid, currency, billing_period_start, billing_period_end, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          subscription.id,
          todayStr,
          subscription.amount,
          subscription.currency,
          todayStr,
          newNextBillingStr,
          'succeeded',
          'Subscription reactivation payment'
        ]
      );

      return {
        message: 'Subscription reactivated successfully',
        reactivationData: {
          id: subscription.id,
          name: subscription.name,
          newLastBilling: todayStr,
          newNextBilling: newNextBillingStr,
          status: 'active'
        }
      };
    }

    throw new Error('Failed to reactivate subscription');
  }

  async resetAllSubscriptions() {
    const paymentHistoryResult = await dbRun(this.env.DB, 'DELETE FROM payment_history');
    const subscriptionResult = await dbRun(this.env.DB, 'DELETE FROM subscriptions');
    const monthlyExpensesResult = await dbRun(this.env.DB, 'DELETE FROM monthly_category_summary');

    return {
      message: 'All subscriptions and related data have been deleted.',
      deletedCounts: {
        subscriptions: subscriptionResult.meta?.changes || 0,
        paymentHistory: paymentHistoryResult.meta?.changes || 0,
        monthlyExpenses: monthlyExpensesResult.meta?.changes || 0
      }
    };
  }

  private async renewSubscription(subscription: Record<string, unknown>, renewalType: 'auto' | 'manual') {
    const todayStr = getTodayString();
    let baseDate: string;

    if (renewalType === 'manual') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentNext = new Date(String(subscription.next_billing_date));
      currentNext.setHours(0, 0, 0, 0);
      baseDate = currentNext >= today ? String(subscription.next_billing_date) : todayStr;
    } else {
      baseDate = String(subscription.next_billing_date);
    }

    const newNextBillingStr = calculateNextBillingDate(baseDate, String(subscription.billing_cycle));

    const updateResult = await dbRun(
      this.env.DB,
      'UPDATE subscriptions SET last_billing_date = ?, next_billing_date = ?, status = ?, updated_at = ? WHERE id = ?',
      [todayStr, newNextBillingStr, 'active', new Date().toISOString(), subscription.id]
    );

    if ((updateResult.meta?.changes || 0) > 0) {
      await dbRun(
        this.env.DB,
        `
          INSERT INTO payment_history (subscription_id, payment_date, amount_paid, currency, billing_period_start, billing_period_end, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          subscription.id,
          todayStr,
          subscription.amount,
          subscription.currency,
          subscription.next_billing_date,
          newNextBillingStr,
          'succeeded',
          renewalType === 'auto' ? 'Auto renewal payment' : 'Manual renewal payment'
        ]
      );

      this.notificationService
        .sendNotification({ subscriptionId: Number(subscription.id), notificationType: 'renewal_success' })
        .catch(() => undefined);

      return {
        success: true,
        data: {
          id: subscription.id,
          name: subscription.name,
          oldNextBilling: subscription.next_billing_date,
          newLastBilling: todayStr,
          newNextBilling: newNextBillingStr,
          renewedEarly: renewalType === 'manual' && new Date(String(subscription.next_billing_date)) >= new Date()
        }
      };
    }

    return { success: false };
  }

  async getStatus() {
    return { isRunning: true, nextRun: null };
  }

  async getSubscriptionManagementStats() {
    const activeAutoRenewal = await this.count({ status: 'active', renewal_type: 'auto' });
    const activeManualRenewal = await this.count({ status: 'active', renewal_type: 'manual' });
    const cancelledSubscriptions = await this.count({ status: 'cancelled' });
    const trialSubscriptions = await this.count({ status: 'trial' });

    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const upcomingRenewals = await dbFirst<{ count: number }>(
      this.env.DB,
      `
        SELECT COUNT(*) as count
        FROM subscriptions
        WHERE status = 'active'
          AND next_billing_date BETWEEN ? AND ?
      `,
      [todayStr, nextWeekStr]
    );

    const overdueSubscriptions = await dbFirst<{ count: number }>(
      this.env.DB,
      `
        SELECT COUNT(*) as count
        FROM subscriptions
        WHERE status = 'active'
          AND renewal_type = 'manual'
          AND next_billing_date < ?
      `,
      [todayStr]
    );

    return {
      subscriptionCounts: {
        activeAutoRenewal,
        activeManualRenewal,
        cancelled: cancelledSubscriptions,
        trial: trialSubscriptions,
        total: activeAutoRenewal + activeManualRenewal + cancelledSubscriptions + trialSubscriptions
      },
      upcomingActions: {
        upcomingRenewals: upcomingRenewals?.count || 0,
        overdueSubscriptions: overdueSubscriptions?.count || 0
      },
      healthMetrics: {
        autoRenewalRate:
          activeAutoRenewal + activeManualRenewal > 0
            ? Math.round((activeAutoRenewal / (activeAutoRenewal + activeManualRenewal)) * 100)
            : 0,
        activeRate:
          activeAutoRenewal + activeManualRenewal + cancelledSubscriptions + trialSubscriptions > 0
            ? Math.round(
                ((activeAutoRenewal + activeManualRenewal) /
                  (activeAutoRenewal + activeManualRenewal + cancelledSubscriptions + trialSubscriptions)) *
                  100
              )
            : 0
      },
      lastUpdated: new Date().toISOString()
    };
  }

  async previewUpcomingRenewals(days = 7) {
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const upcomingSubscriptions = await dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT * FROM subscriptions
        WHERE status = 'active'
          AND next_billing_date BETWEEN ? AND ?
        ORDER BY next_billing_date ASC
      `,
      [todayStr, futureDateStr]
    );

    const autoRenewals = upcomingSubscriptions.filter((sub) => sub.renewal_type === 'auto');
    const manualRenewals = upcomingSubscriptions.filter((sub) => sub.renewal_type === 'manual');

    return {
      period: { from: todayStr, to: futureDateStr, days },
      summary: {
        total: upcomingSubscriptions.length,
        autoRenewals: autoRenewals.length,
        manualRenewals: manualRenewals.length
      },
      subscriptions: {
        autoRenewals: autoRenewals.map((sub) => ({
          id: sub.id,
          name: sub.name,
          amount: sub.amount,
          currency: sub.currency,
          nextBillingDate: sub.next_billing_date,
          billingCycle: sub.billing_cycle
        })),
        manualRenewals: manualRenewals.map((sub) => ({
          id: sub.id,
          name: sub.name,
          amount: sub.amount,
          currency: sub.currency,
          nextBillingDate: sub.next_billing_date,
          billingCycle: sub.billing_cycle
        }))
      }
    };
  }
}
