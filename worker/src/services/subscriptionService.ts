import type { Env } from '../types';
import { dbAll, dbFirst, dbRun, normalizeResult } from '../utils/db';
import { calculateLastBillingDate, calculateNextBillingDateFromStart, getTodayString } from '../utils/dateUtils';
import { MonthlyCategorySummaryService } from './monthlyCategorySummaryService';
import { NotificationService } from './notificationService';
import { NotFoundError } from '../utils/errors';

export class SubscriptionService {
  private monthlyCategorySummaryService: MonthlyCategorySummaryService;
  private notificationService: NotificationService;

  constructor(private env: Env) {
    this.monthlyCategorySummaryService = new MonthlyCategorySummaryService(env);
    this.notificationService = new NotificationService(env);
  }

  async getAllSubscriptions() {
    const rows = await dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT
          s.*,
          c.id as category_join_id,
          c.value as category_join_value,
          c.label as category_join_label,
          pm.id as payment_method_join_id,
          pm.value as payment_method_join_value,
          pm.label as payment_method_join_label
        FROM subscriptions s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
        ORDER BY s.name ASC
      `
    );

    return rows.map((row) => ({
      ...row,
      category: row.category_join_id
        ? {
            id: row.category_join_id,
            value: row.category_join_value,
            label: row.category_join_label
          }
        : null,
      paymentMethod: row.payment_method_join_id
        ? {
            id: row.payment_method_join_id,
            value: row.payment_method_join_value,
            label: row.payment_method_join_label
          }
        : null
    }));
  }

  async getSubscriptionById(id: number) {
    const row = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT
          s.*,
          c.id as category_join_id,
          c.value as category_join_value,
          c.label as category_join_label,
          pm.id as payment_method_join_id,
          pm.value as payment_method_join_value,
          pm.label as payment_method_join_label
        FROM subscriptions s
        LEFT JOIN categories c ON s.category_id = c.id
        LEFT JOIN payment_methods pm ON s.payment_method_id = pm.id
        WHERE s.id = ?
      `,
      [id]
    );

    if (!row) return null;

    return {
      ...row,
      category: row.category_join_id
        ? {
            id: row.category_join_id,
            value: row.category_join_value,
            label: row.category_join_label
          }
        : null,
      paymentMethod: row.payment_method_join_id
        ? {
            id: row.payment_method_join_id,
            value: row.payment_method_join_value,
            label: row.payment_method_join_label
          }
        : null
    };
  }

  async createSubscription(subscriptionData: Record<string, unknown>) {
    const {
      name,
      plan,
      billing_cycle,
      next_billing_date,
      amount,
      currency,
      payment_method_id,
      start_date,
      status = 'active',
      category_id,
      renewal_type = 'manual',
      notes,
      website
    } = subscriptionData as Record<string, string>;

    const last_billing_date = calculateLastBillingDate(
      String(next_billing_date),
      String(start_date),
      String(billing_cycle)
    );

    const result = await dbRun(
      this.env.DB,
      `
        INSERT INTO subscriptions
        (name, plan, billing_cycle, next_billing_date, last_billing_date, amount, currency, payment_method_id, start_date, status, category_id, renewal_type, notes, website)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        plan,
        billing_cycle,
        next_billing_date,
        last_billing_date,
        amount,
        currency,
        payment_method_id,
        start_date,
        status,
        category_id,
        renewal_type,
        notes || null,
        website || null
      ]
    );

    const normalized = normalizeResult(result);
    if (normalized.lastInsertRowid) {
      await this.generatePaymentHistory(normalized.lastInsertRowid, subscriptionData);
    }

    return normalized;
  }

  async bulkCreateSubscriptions(subscriptionsData: Record<string, unknown>[]) {
    const results: Array<{ changes: number; lastInsertRowid: number | null }> = [];
    for (const subscriptionData of subscriptionsData) {
      const result = await this.createSubscription(subscriptionData);
      results.push(result);
    }
    return results;
  }

  async updateSubscription(id: number, updateData: Record<string, unknown>) {
    const existing = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM subscriptions WHERE id = ?',
      [id]
    );
    if (!existing) throw new NotFoundError('Subscription');

    if (updateData.billing_cycle || updateData.next_billing_date || updateData.start_date) {
      const billingCycle = (updateData.billing_cycle || existing.billing_cycle) as string;
      const startDate = (updateData.start_date || existing.start_date) as string;
      let nextBillingDate: string;

      if (updateData.next_billing_date) {
        nextBillingDate = String(updateData.next_billing_date);
      } else if (updateData.start_date || updateData.billing_cycle) {
        const currentDate = getTodayString();
        nextBillingDate = calculateNextBillingDateFromStart(startDate, currentDate, billingCycle);
        updateData.next_billing_date = nextBillingDate;
      } else {
        nextBillingDate = String(existing.next_billing_date);
      }

      updateData.last_billing_date = calculateLastBillingDate(nextBillingDate, startDate, billingCycle);
    }

    const fields = Object.keys(updateData);
    if (!fields.length) return { changes: 0, lastInsertRowid: null };

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => (updateData as Record<string, unknown>)[field]);
    const result = await dbRun(
      this.env.DB,
      `UPDATE subscriptions SET ${setClause} WHERE id = ?`,
      [...values, id]
    );

    const normalized = normalizeResult(result);

    const keyFields = ['amount', 'billing_cycle', 'start_date', 'status'];
    const hasKeyFieldUpdate = keyFields.some((field) => Object.prototype.hasOwnProperty.call(updateData, field));
    if (hasKeyFieldUpdate) {
      await this.regeneratePaymentHistory(id);
    }

    this.notificationService
      .sendNotification({ subscriptionId: id, notificationType: 'subscription_change' })
      .catch(() => undefined);

    return normalized;
  }

  async deleteSubscription(id: number) {
    const existing = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM subscriptions WHERE id = ?',
      [id]
    );
    if (!existing) throw new NotFoundError('Subscription');

    const paymentMonths = await dbAll<{ year: string; month: string }>(
      this.env.DB,
      `
        SELECT DISTINCT strftime('%Y', payment_date) as year, strftime('%m', payment_date) as month
        FROM payment_history
        WHERE subscription_id = ? AND status = 'succeeded'
      `,
      [id]
    );

    const result = await dbRun(this.env.DB, 'DELETE FROM subscriptions WHERE id = ?', [id]);
    const normalized = normalizeResult(result);

    for (const { year, month } of paymentMonths) {
      await this.monthlyCategorySummaryService.updateMonthlyCategorySummary(parseInt(year, 10), parseInt(month, 10));
    }

    return normalized;
  }

  async getSubscriptionStats() {
    const totalStats = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'trial' THEN 1 END) as trial,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as total_active_amount,
          AVG(CASE WHEN status = 'active' THEN amount ELSE NULL END) as avg_active_amount
        FROM subscriptions
      `
    );

    const categoryStats = await dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT 
          c.label as category,
          COUNT(*) as count,
          SUM(CASE WHEN s.status = 'active' THEN s.amount ELSE 0 END) as total_amount
        FROM subscriptions s
        LEFT JOIN categories c ON s.category_id = c.id
        GROUP BY s.category_id
        ORDER BY count DESC
      `
    );

    const billingCycleStats = await dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT billing_cycle, COUNT(*) as count, SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as total_amount
        FROM subscriptions
        GROUP BY billing_cycle
        ORDER BY count DESC
      `
    );

    return {
      total: totalStats,
      byCategory: categoryStats,
      byBillingCycle: billingCycleStats
    };
  }

  async getUpcomingRenewals(days = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateString = futureDate.toISOString().split('T')[0];

    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT * FROM subscriptions
        WHERE status = 'active' AND next_billing_date <= ? AND next_billing_date >= ?
        ORDER BY next_billing_date ASC
      `,
      [futureDateString, getTodayString()]
    );
  }

  async getExpiredSubscriptions() {
    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT * FROM subscriptions
        WHERE status = 'active' AND next_billing_date < ?
        ORDER BY next_billing_date ASC
      `,
      [getTodayString()]
    );
  }

  async getSubscriptionsByCategory(category: string) {
    const isNumeric = /^\d+$/.test(category);
    if (isNumeric) {
      return dbAll<Record<string, unknown>>(
        this.env.DB,
        'SELECT * FROM subscriptions WHERE category_id = ? ORDER BY name ASC',
        [Number(category)]
      );
    }

    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT s.*
        FROM subscriptions s
        JOIN categories c ON s.category_id = c.id
        WHERE c.value = ?
        ORDER BY s.name ASC
      `,
      [category]
    );
  }

  async getSubscriptionsByStatus(status: string) {
    return dbAll<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM subscriptions WHERE status = ? ORDER BY name ASC',
      [status]
    );
  }

  async searchSubscriptions(query: string) {
    const searchTerm = `%${query}%`;
    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT * FROM subscriptions
        WHERE name LIKE ? OR plan LIKE ? OR notes LIKE ?
        ORDER BY name ASC
      `,
      [searchTerm, searchTerm, searchTerm]
    );
  }

  async getSubscriptionPaymentHistory(subscriptionId: number) {
    return dbAll<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM payment_history WHERE subscription_id = ? ORDER BY payment_date DESC',
      [subscriptionId]
    );
  }

  async resetAllSubscriptions() {
    const subscriptionResult = await dbRun(this.env.DB, 'DELETE FROM subscriptions');
    const monthlyResult = await dbRun(this.env.DB, 'DELETE FROM monthly_category_summary');

    return {
      subscriptions: subscriptionResult.meta?.changes || 0,
      monthlyCategorySummary: monthlyResult.meta?.changes || 0,
      message: 'All subscription data has been reset successfully'
    };
  }

  private async generatePaymentHistory(subscriptionId: number, subscriptionData: Record<string, unknown>) {
    const fullSubscription = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM subscriptions WHERE id = ?',
      [subscriptionId]
    );
    if (!fullSubscription) throw new Error(`Subscription ${subscriptionId} not found`);

    const payments = this.generateHistoricalPayments(fullSubscription);

    for (const payment of payments) {
      const result = await dbRun(
        this.env.DB,
        `
          INSERT INTO payment_history
          (subscription_id, payment_date, amount_paid, currency, billing_period_start, billing_period_end, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          subscriptionId,
          payment.payment_date,
          fullSubscription.amount,
          fullSubscription.currency,
          payment.billing_period_start,
          payment.billing_period_end,
          'succeeded',
          'Auto-generated from subscription data'
        ]
      );

      const lastId = result.meta?.last_row_id;
      if (lastId) {
        await this.monthlyCategorySummaryService.processNewPayment(lastId);
      }
    }
  }

  private async regeneratePaymentHistory(subscriptionId: number) {
    const subscription = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM subscriptions WHERE id = ?',
      [subscriptionId]
    );
    if (!subscription) throw new Error(`Subscription ${subscriptionId} not found`);

    await dbRun(this.env.DB, 'DELETE FROM payment_history WHERE subscription_id = ?', [subscriptionId]);
    await this.generatePaymentHistory(subscriptionId, subscription);
  }

  private generateHistoricalPayments(subscription: Record<string, unknown>) {
    const payments: Array<{ payment_date: string; billing_period_start: string; billing_period_end: string }> = [];
    const startDate = new Date(String(subscription.start_date));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = new Date(startDate);
    const endDate = subscription.last_billing_date
      ? new Date(String(subscription.last_billing_date))
      : today;

    while (currentDate <= endDate) {
      const billingPeriodEnd = this.calculateNextBillingDate(currentDate, String(subscription.billing_cycle));

      payments.push({
        payment_date: currentDate.toISOString().split('T')[0],
        billing_period_start: currentDate.toISOString().split('T')[0],
        billing_period_end: billingPeriodEnd.toISOString().split('T')[0]
      });

      currentDate = new Date(billingPeriodEnd);
    }

    return payments;
  }

  private calculateNextBillingDate(currentDate: Date, billingCycle: string) {
    const nextDate = new Date(currentDate);
    switch (billingCycle) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'semiannual':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        throw new Error(`Unsupported billing cycle: ${billingCycle}`);
    }
    return nextDate;
  }
}
