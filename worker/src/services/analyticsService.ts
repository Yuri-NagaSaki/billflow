import type { Env } from '../types';
import { dbAll } from '../utils/db';

export class AnalyticsService {
  constructor(private env: Env) {}

  async getMonthlyRevenue(filters: { start_date?: string; end_date?: string; currency?: string }) {
    const { start_date, end_date, currency } = filters;

    let query = `
      SELECT
        strftime('%Y-%m', payment_date) as month,
        currency,
        SUM(amount_paid) as total_revenue,
        COUNT(id) as payment_count,
        AVG(amount_paid) as average_payment
      FROM payment_history
      WHERE status = 'succeeded'
    `;

    const params: unknown[] = [];
    if (start_date) {
      query += ' AND payment_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND payment_date <= ?';
      params.push(end_date);
    }
    if (currency) {
      query += ' AND currency = ?';
      params.push(currency);
    }

    query += " GROUP BY strftime('%Y-%m', payment_date), currency ORDER BY month DESC, currency";

    const results = await dbAll<Record<string, unknown>>(this.env.DB, query, params);

    const monthlyStats = results.map((row) => ({
      month: row.month,
      currency: row.currency,
      totalRevenue: Number(row.total_revenue),
      paymentCount: row.payment_count,
      averagePayment: Number(row.average_payment)
    }));

    const summary = {
      totalMonths: new Set(results.map((r) => r.month)).size,
      totalRevenue: results.reduce((sum, r) => sum + Number(r.total_revenue), 0),
      totalPayments: results.reduce((sum, r) => sum + Number(r.payment_count || 0), 0),
      currencies: [...new Set(results.map((r) => r.currency))]
    };

    return {
      monthlyStats,
      summary,
      filters: {
        startDate: start_date || null,
        endDate: end_date || null,
        currency: currency || null
      }
    };
  }

  async getMonthlyActiveSubscriptions(year: number, month: number) {
    const monthStr = String(month).padStart(2, '0');
    const targetMonth = `${year}-${monthStr}`;
    const firstDay = `${targetMonth}-01`;
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

    const query = `
      SELECT DISTINCT
        s.id,
        s.name,
        s.plan,
        s.amount,
        s.currency,
        s.billing_cycle,
        s.status,
        s.category_id,
        COUNT(ph.id) as payment_count_in_month,
        SUM(ph.amount_paid) as total_paid_in_month,
        MIN(ph.billing_period_start) as earliest_period_start,
        MAX(ph.billing_period_end) as latest_period_end
      FROM subscriptions s
      INNER JOIN payment_history ph ON s.id = ph.subscription_id
      WHERE ph.status = 'succeeded'
        AND (
          (ph.billing_period_start <= ? AND ph.billing_period_end >= ?) OR
          (ph.billing_period_start <= ? AND ph.billing_period_end >= ?) OR
          (ph.billing_period_start >= ? AND ph.billing_period_start <= ?)
        )
      GROUP BY s.id, s.name, s.plan, s.amount, s.currency, s.billing_cycle, s.status, s.category_id
      ORDER BY s.name
    `;

    const activeSubscriptions = await dbAll<Record<string, unknown>>(
      this.env.DB,
      query,
      [lastDay, firstDay, firstDay, lastDay, firstDay, lastDay]
    );

    const formattedSubscriptions = activeSubscriptions.map((sub) => ({
      id: sub.id,
      name: sub.name,
      plan: sub.plan,
      amount: Number(sub.amount),
      currency: sub.currency,
      billingCycle: sub.billing_cycle,
      status: sub.status,
      category: sub.category_id,
      paymentCountInMonth: sub.payment_count_in_month,
      totalPaidInMonth: Number(sub.total_paid_in_month || 0),
      activePeriod: {
        start: sub.earliest_period_start,
        end: sub.latest_period_end
      }
    }));

    const summary = {
      totalActiveSubscriptions: activeSubscriptions.length,
      totalRevenue: 0,
      totalPayments: 0,
      byCategory: {} as Record<string, { count: number; revenue: number }>,
      byCurrency: {} as Record<string, { count: number; revenue: number }>,
      byBillingCycle: {} as Record<string, { count: number; revenue: number }>
    };

    activeSubscriptions.forEach((sub) => {
      const revenue = Number(sub.total_paid_in_month || 0);
      const paymentCount = Number(sub.payment_count_in_month || 0);

      summary.totalRevenue += revenue;
      summary.totalPayments += paymentCount;

      const categoryKey = String(sub.category_id ?? 'unknown');
      if (!summary.byCategory[categoryKey]) summary.byCategory[categoryKey] = { count: 0, revenue: 0 };
      summary.byCategory[categoryKey].count += 1;
      summary.byCategory[categoryKey].revenue += revenue;

      const currencyKey = String(sub.currency);
      if (!summary.byCurrency[currencyKey]) summary.byCurrency[currencyKey] = { count: 0, revenue: 0 };
      summary.byCurrency[currencyKey].count += 1;
      summary.byCurrency[currencyKey].revenue += revenue;

      const billingKey = String(sub.billing_cycle);
      if (!summary.byBillingCycle[billingKey]) summary.byBillingCycle[billingKey] = { count: 0, revenue: 0 };
      summary.byBillingCycle[billingKey].count += 1;
      summary.byBillingCycle[billingKey].revenue += revenue;
    });

    return {
      targetMonth,
      period: { start: firstDay, end: lastDay },
      activeSubscriptions: formattedSubscriptions,
      summary
    };
  }
}
