import type { Env } from '../types';
import { getBaseCurrency } from '../config/currencies';
import { dbAll, dbFirst, dbRun } from '../utils/db';

export class MonthlyCategorySummaryService {
  private baseCurrency: string;

  constructor(private env: Env) {
    this.baseCurrency = getBaseCurrency(env);
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string) {
    if (fromCurrency === toCurrency) return 1.0;

    const direct = await dbFirst<{ rate: number }>(
      this.env.DB,
      'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?',
      [fromCurrency, toCurrency]
    );
    if (direct) return Number(direct.rate);

    const reverse = await dbFirst<{ rate: number }>(
      this.env.DB,
      'SELECT rate FROM exchange_rates WHERE from_currency = ? AND to_currency = ?',
      [toCurrency, fromCurrency]
    );
    if (reverse) {
      const reverseRate = Number(reverse.rate);
      if (reverseRate !== 0) return 1 / reverseRate;
    }

    const base = getBaseCurrency(this.env);
    if (fromCurrency !== base && toCurrency !== base) {
      const toBase = await this.getExchangeRate(fromCurrency, base);
      const fromBase = await this.getExchangeRate(base, toCurrency);
      if (toBase !== 1.0 && fromBase !== 1.0) {
        return toBase * fromBase;
      }
    }

    return 1.0;
  }

  async updateMonthlyCategorySummary(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const payments = await dbAll<{
      id: number;
      amount_paid: number;
      currency: string;
      payment_date: string;
      category_id: number;
      resolved_category_id: number;
    }>(
      this.env.DB,
      `
        SELECT 
          ph.id,
          ph.amount_paid,
          ph.currency,
          ph.payment_date,
          s.category_id,
          COALESCE(c.id, (SELECT id FROM categories WHERE value = 'other')) as resolved_category_id
        FROM payment_history ph
        JOIN subscriptions s ON ph.subscription_id = s.id
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE ph.payment_date >= ? AND ph.payment_date <= ?
          AND ph.status = 'succeeded'
        ORDER BY s.category_id
      `,
      [startDate, endDate]
    );

    if (!payments.length) return;

    const categoryData: Record<number, { totalAmount: number; transactionCount: number }> = {};

    for (const payment of payments) {
      const categoryId = payment.resolved_category_id;
      if (!categoryData[categoryId]) {
        categoryData[categoryId] = { totalAmount: 0, transactionCount: 0 };
      }
      const rate = await this.getExchangeRate(payment.currency, this.baseCurrency);
      const amountInBase = Number(payment.amount_paid) * rate;
      categoryData[categoryId].totalAmount += amountInBase;
      categoryData[categoryId].transactionCount += 1;
    }

    await dbRun(
      this.env.DB,
      'DELETE FROM monthly_category_summary WHERE year = ? AND month = ?',
      [year, month]
    );

    for (const [categoryId, data] of Object.entries(categoryData)) {
      await dbRun(
        this.env.DB,
        `
          INSERT INTO monthly_category_summary
          (year, month, category_id, total_amount_in_base_currency, base_currency, transactions_count)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          year,
          month,
          Number(categoryId),
          Math.round(data.totalAmount * 100) / 100,
          this.baseCurrency,
          data.transactionCount
        ]
      );
    }
  }

  async recalculateAllMonthlyCategorySummaries() {
    const months = await dbAll<{ year: string; month: string }>(
      this.env.DB,
      `
        SELECT DISTINCT strftime('%Y', payment_date) as year, strftime('%m', payment_date) as month
        FROM payment_history
        WHERE status = 'succeeded'
        ORDER BY year, month
      `
    );

    if (!months.length) return;

    await dbRun(this.env.DB, 'DELETE FROM monthly_category_summary');

    for (const monthData of months) {
      await this.updateMonthlyCategorySummary(parseInt(monthData.year, 10), parseInt(monthData.month, 10));
    }
  }

  async processNewPayment(paymentId: number) {
    const payment = await dbFirst<{ year: string; month: string }>(
      this.env.DB,
      `
        SELECT strftime('%Y', payment_date) as year, strftime('%m', payment_date) as month
        FROM payment_history
        WHERE id = ? AND status = 'succeeded'
      `,
      [paymentId]
    );

    if (!payment) return;

    await this.updateMonthlyCategorySummary(parseInt(payment.year, 10), parseInt(payment.month, 10));
  }

  async processPaymentDeletion(year: number, month: number) {
    await this.updateMonthlyCategorySummary(year, month);
  }

  async getMonthlyCategorySummary(startYear: number, startMonth: number, endYear: number, endMonth: number) {
    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT 
          mcs.*, c.value as category_value, c.label as category_label
        FROM monthly_category_summary mcs
        JOIN categories c ON mcs.category_id = c.id
        WHERE (mcs.year > ? OR (mcs.year = ? AND mcs.month >= ?))
          AND (mcs.year < ? OR (mcs.year = ? AND mcs.month <= ?))
        ORDER BY mcs.year, mcs.month, c.label
      `,
      [startYear, startYear, startMonth, endYear, endYear, endMonth]
    );
  }

  async getMonthCategorySummary(year: number, month: number) {
    return dbAll<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT 
          mcs.*, c.value as category_value, c.label as category_label
        FROM monthly_category_summary mcs
        JOIN categories c ON mcs.category_id = c.id
        WHERE mcs.year = ? AND mcs.month = ?
        ORDER BY mcs.total_amount_in_base_currency DESC
      `,
      [year, month]
    );
  }

  async getTotalSummary(startYear: number, startMonth: number, endYear: number, endMonth: number) {
    return dbFirst<Record<string, unknown>>(
      this.env.DB,
      `
        SELECT 
          SUM(total_amount_in_base_currency) as total_amount,
          SUM(transactions_count) as total_transactions,
          base_currency
        FROM monthly_category_summary
        WHERE (year > ? OR (year = ? AND month >= ?))
          AND (year < ? OR (year = ? AND month <= ?))
        GROUP BY base_currency
      `,
      [startYear, startYear, startMonth, endYear, endYear, endMonth]
    );
  }
}
