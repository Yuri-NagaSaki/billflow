import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { MonthlyCategorySummaryService } from '../services/monthlyCategorySummaryService';
import { handleQueryResult, validationError } from '../utils/response';
import { requireLogin } from '../middleware/requireLogin';

export const monthlyCategorySummaryRoutes = new Hono<HonoEnv>();
export const protectedMonthlyCategorySummaryRoutes = new Hono<HonoEnv>();

monthlyCategorySummaryRoutes.get('/', async (c) => {
  const startYear = Number(c.req.query('start_year') || '0');
  const startMonth = Number(c.req.query('start_month') || '0');
  const endYear = Number(c.req.query('end_year') || '0');
  const endMonth = Number(c.req.query('end_month') || '0');

  const now = new Date();
  const defaultStartYear = now.getFullYear() - 1;
  const defaultStartMonth = now.getMonth() + 1;

  const resolvedStartYear = startYear || defaultStartYear;
  const resolvedStartMonth = startMonth || defaultStartMonth;
  const resolvedEndYear = endYear || now.getFullYear();
  const resolvedEndMonth = endMonth || now.getMonth() + 1;

  const service = new MonthlyCategorySummaryService(c.env);
  const summaries = await service.getMonthlyCategorySummary(
    resolvedStartYear,
    resolvedStartMonth,
    resolvedEndYear,
    resolvedEndMonth
  );

  const formatted = summaries.map((summary) => ({
    year: summary.year,
    month: summary.month,
    monthKey: `${summary.year}-${String(summary.month).padStart(2, '0')}`,
    categoryId: summary.category_id,
    categoryValue: summary.category_value,
    categoryLabel: summary.category_label,
    totalAmount: Number(summary.total_amount_in_base_currency),
    baseCurrency: summary.base_currency,
    transactionsCount: summary.transactions_count,
    updatedAt: summary.updated_at
  }));

  return handleQueryResult(c, {
    summaries: formatted,
    summary: {
      totalRecords: formatted.length,
      dateRange: {
        startYear: resolvedStartYear,
        startMonth: resolvedStartMonth,
        endYear: resolvedEndYear,
        endMonth: resolvedEndMonth
      }
    }
  }, 'Monthly category summaries');
});

monthlyCategorySummaryRoutes.get('/total', async (c) => {
  const startYear = Number(c.req.query('start_year') || '0');
  const startMonth = Number(c.req.query('start_month') || '0');
  const endYear = Number(c.req.query('end_year') || '0');
  const endMonth = Number(c.req.query('end_month') || '0');

  if (!startYear || !startMonth || !endYear || !endMonth) {
    return validationError(c, 'start_year, start_month, end_year, end_month are required');
  }

  const service = new MonthlyCategorySummaryService(c.env);
  const total = await service.getTotalSummary(startYear, startMonth, endYear, endMonth);

  return handleQueryResult(c, {
    dateRange: { startYear, startMonth, endYear, endMonth },
    totalAmount: Number(total?.total_amount || 0),
    totalTransactions: Number(total?.total_transactions || 0),
    baseCurrency: total?.base_currency || 'CNY'
  }, 'Total summary');
});

monthlyCategorySummaryRoutes.get('/:year/:month', async (c) => {
  const year = Number(c.req.param('year'));
  const month = Number(c.req.param('month'));

  if (!year || !month) {
    return validationError(c, 'year and month are required');
  }

  const service = new MonthlyCategorySummaryService(c.env);
  const summaries = await service.getMonthCategorySummary(year, month);

  const categories = summaries.map((summary) => ({
    categoryId: summary.category_id,
    categoryValue: summary.category_value,
    categoryLabel: summary.category_label,
    totalAmount: Number(summary.total_amount_in_base_currency),
    baseCurrency: summary.base_currency,
    transactionsCount: summary.transactions_count,
    updatedAt: summary.updated_at
  }));

  const totalAmount = categories.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const totalTransactions = categories.reduce((sum, item) => sum + Number(item.transactionsCount || 0), 0);
  const baseCurrency = categories[0]?.baseCurrency || 'CNY';

  return handleQueryResult(c, {
    year,
    month,
    categories,
    totalAmount,
    totalTransactions,
    baseCurrency
  }, 'Month category summary');
});

protectedMonthlyCategorySummaryRoutes.use('*', requireLogin);

protectedMonthlyCategorySummaryRoutes.post('/recalculate', async (c) => {
  const service = new MonthlyCategorySummaryService(c.env);
  await service.recalculateAllMonthlyCategorySummaries();
  return c.json({ message: 'Monthly summaries recalculated successfully', timestamp: new Date().toISOString() });
});

protectedMonthlyCategorySummaryRoutes.post('/process-payment/:id', async (c) => {
  const paymentId = Number(c.req.param('id'));
  if (!paymentId) return validationError(c, 'paymentId is required');
  const service = new MonthlyCategorySummaryService(c.env);
  await service.processNewPayment(paymentId);
  return c.json({ message: 'Payment processed successfully', paymentId, timestamp: new Date().toISOString() });
});
