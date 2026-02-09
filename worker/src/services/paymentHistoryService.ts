import type { Env } from '../types';
import { dbAll, dbFirst, dbRun, normalizeResult } from '../utils/db';
import { MonthlyCategorySummaryService } from './monthlyCategorySummaryService';
import { NotFoundError } from '../utils/errors';

export class PaymentHistoryService {
  private monthlyCategorySummaryService: MonthlyCategorySummaryService;

  constructor(private env: Env) {
    this.monthlyCategorySummaryService = new MonthlyCategorySummaryService(env);
  }

  async getPaymentHistory(filters: Record<string, unknown> = {}, options: { limit?: number; offset?: number } = {}) {
    let query = `
      SELECT ph.*, s.name as subscription_name, s.plan as subscription_plan
      FROM payment_history ph
      LEFT JOIN subscriptions s ON ph.subscription_id = s.id
      WHERE 1=1
    `;

    const params: unknown[] = [];

    if (filters.subscription_id) {
      query += ' AND ph.subscription_id = ?';
      params.push(filters.subscription_id);
    }
    if (filters.start_date) {
      query += ' AND ph.payment_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND ph.payment_date <= ?';
      params.push(filters.end_date);
    }
    if (filters.status) {
      query += ' AND ph.status = ?';
      params.push(filters.status);
    }
    if (filters.currency) {
      query += ' AND ph.currency = ?';
      params.push(filters.currency);
    }

    query += ' ORDER BY ph.payment_date DESC, ph.id DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    return dbAll<Record<string, unknown>>(this.env.DB, query, params);
  }

  async getPaymentById(id: number) {
    return dbFirst<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT ph.*, s.name as subscription_name, s.plan as subscription_plan
        FROM payment_history ph
        LEFT JOIN subscriptions s ON ph.subscription_id = s.id
        WHERE ph.id = ?
      `,
      [id]
    );
  }

  async getMonthlyStats(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT
          COUNT(*) as total_payments,
          SUM(CASE WHEN status = 'succeeded' THEN amount_paid ELSE 0 END) as total_amount,
          COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
          currency,
          AVG(CASE WHEN status = 'succeeded' THEN amount_paid ELSE NULL END) as avg_payment_amount
        FROM payment_history
        WHERE payment_date >= ? AND payment_date <= ?
        GROUP BY currency
        ORDER BY total_amount DESC
      `,
      [startDate, endDate]
    );
  }

  async getYearlyStats(year: number) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT
          strftime('%m', payment_date) as month,
          COUNT(*) as total_payments,
          SUM(CASE WHEN status = 'succeeded' THEN amount_paid ELSE 0 END) as total_amount,
          COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
          currency
        FROM payment_history
        WHERE payment_date >= ? AND payment_date <= ?
        GROUP BY strftime('%m', payment_date), currency
        ORDER BY month, currency
      `,
      [startDate, endDate]
    );
  }

  async getQuarterlyStats(year: number, quarter: number) {
    const quarterMonths: Record<number, { start: string; end: string }> = {
      1: { start: '01', end: '03' },
      2: { start: '04', end: '06' },
      3: { start: '07', end: '09' },
      4: { start: '10', end: '12' }
    };
    const { start, end } = quarterMonths[quarter];
    const startDate = `${year}-${start}-01`;
    const endDate = `${year}-${end}-31`;

    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT
          strftime('%m', payment_date) as month,
          COUNT(*) as total_payments,
          SUM(CASE WHEN status = 'succeeded' THEN amount_paid ELSE 0 END) as total_amount,
          COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
          currency
        FROM payment_history
        WHERE payment_date >= ? AND payment_date <= ?
        GROUP BY strftime('%m', payment_date), currency
        ORDER BY month, currency
      `,
      [startDate, endDate]
    );
  }

  async createPayment(paymentData: Record<string, unknown>) {
    const {
      subscription_id,
      payment_date,
      amount_paid,
      currency,
      billing_period_start,
      billing_period_end,
      status = 'succeeded',
      notes
    } = paymentData;

    const subscriptionExists = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT id FROM subscriptions WHERE id = ?',
      [subscription_id]
    );
    if (!subscriptionExists) throw new NotFoundError('Subscription');

    const result = await dbRun(
      this.env.DB,
      `
        INSERT INTO payment_history
        (subscription_id, payment_date, amount_paid, currency, billing_period_start, billing_period_end, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        subscription_id,
        payment_date,
        amount_paid,
        currency,
        billing_period_start,
        billing_period_end,
        status,
        notes || null
      ]
    );

    const normalized = normalizeResult(result);
    if (status === 'succeeded' && normalized.lastInsertRowid) {
      await this.monthlyCategorySummaryService.processNewPayment(normalized.lastInsertRowid);
    }

    return normalized;
  }

  async updatePayment(id: number, updateData: Record<string, unknown>) {
    const existing = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM payment_history WHERE id = ?',
      [id]
    );
    if (!existing) throw new NotFoundError('Payment record');

    const fields = Object.keys(updateData);
    if (!fields.length) return { changes: 0, lastInsertRowid: null };

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => (updateData as Record<string, unknown>)[field]);

    const result = await dbRun(
      this.env.DB,
      `UPDATE payment_history SET ${setClause} WHERE id = ?`,
      [...values, id]
    );

    const fieldsAffectingSummary = [
      'payment_date',
      'amount_paid',
      'currency',
      'status',
      'billing_period_start',
      'billing_period_end'
    ];

    const hasSignificantChanges = fieldsAffectingSummary.some(
      (field) => updateData[field] !== undefined && updateData[field] !== (existing as Record<string, unknown>)[field]
    );

    if (hasSignificantChanges) {
      const monthsToUpdate = new Set<string>();
      if (updateData.payment_date && updateData.payment_date !== existing.payment_date) {
        const oldDate = new Date(String(existing.payment_date));
        const newDate = new Date(String(updateData.payment_date));
        monthsToUpdate.add(`${oldDate.getFullYear()}-${oldDate.getMonth() + 1}`);
        monthsToUpdate.add(`${newDate.getFullYear()}-${newDate.getMonth() + 1}`);
      } else {
        const paymentDate = new Date(String(existing.payment_date));
        monthsToUpdate.add(`${paymentDate.getFullYear()}-${paymentDate.getMonth() + 1}`);
      }

      for (const monthKey of monthsToUpdate) {
        const [year, month] = monthKey.split('-').map(Number);
        await this.monthlyCategorySummaryService.updateMonthlyCategorySummary(year, month);
      }
    }

    return normalizeResult(result);
  }

  async deletePayment(id: number) {
    const existing = await dbFirst<Record<string, unknown>>(
      this.env.DB,
      'SELECT * FROM payment_history WHERE id = ?',
      [id]
    );
    if (!existing) throw new NotFoundError('Payment record');

    const result = await dbRun(this.env.DB, 'DELETE FROM payment_history WHERE id = ?', [id]);

    if (existing.status === 'succeeded') {
      const paymentDate = new Date(String(existing.payment_date));
      await this.monthlyCategorySummaryService.processPaymentDeletion(paymentDate.getFullYear(), paymentDate.getMonth() + 1);
    }

    return normalizeResult(result);
  }

  async bulkCreatePayments(paymentsData: Record<string, unknown>[]) {
    const results = [];
    for (const paymentData of paymentsData) {
      const result = await this.createPayment(paymentData);
      results.push(result);
    }
    return results;
  }

  async recalculateMonthlyCategorySummaries() {
    await this.monthlyCategorySummaryService.recalculateAllMonthlyCategorySummaries();
  }
}
