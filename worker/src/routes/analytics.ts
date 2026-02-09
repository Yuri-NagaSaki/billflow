import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { AnalyticsService } from '../services/analyticsService';
import { createValidator } from '../utils/validator';
import { handleQueryResult, validationError } from '../utils/response';
import { getBaseCurrency } from '../config/currencies';

export const analyticsRoutes = new Hono<HonoEnv>();

analyticsRoutes.get('/monthly-revenue', async (c) => {
  const { start_date, end_date, currency } = c.req.query();
  const validator = createValidator();
  if (start_date) validator.date(start_date, 'start_date');
  if (end_date) validator.date(end_date, 'end_date');
  if (currency) validator.string(currency, 'currency').length(currency, 'currency', 3, 3);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
    return validationError(c, 'start_date must be before end_date');
  }

  const service = new AnalyticsService(c.env);
  const result = await service.getMonthlyRevenue({ start_date, end_date, currency });
  return handleQueryResult(c, result, 'Monthly revenue statistics');
});

analyticsRoutes.get('/monthly-active-subscriptions', async (c) => {
  const month = Number(c.req.query('month'));
  const year = Number(c.req.query('year'));

  const validator = createValidator();
  validator
    .required(month, 'month')
    .integer(month, 'month')
    .range(month, 'month', 1, 12)
    .required(year, 'year')
    .integer(year, 'year')
    .range(year, 'year', 2000, 3000);

  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new AnalyticsService(c.env);
  const result = await service.getMonthlyActiveSubscriptions(year, month);
  return handleQueryResult(c, result, 'Monthly active subscriptions');
});

analyticsRoutes.get('/revenue-trends', async (c) => {
  const { start_date, end_date, currency, period = 'monthly' } = c.req.query();
  const validator = createValidator();
  if (start_date) validator.date(start_date, 'start_date');
  if (end_date) validator.date(end_date, 'end_date');
  validator
    .string(currency || getBaseCurrency(c.env), 'currency')
    .length(currency || getBaseCurrency(c.env), 'currency', 3, 3)
    .enum(period, 'period', ['monthly', 'quarterly', 'yearly']);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new AnalyticsService(c.env);
  const revenueData = await service.getMonthlyRevenue({
    start_date,
    end_date,
    currency: currency || getBaseCurrency(c.env)
  });

  const trendsData = aggregateRevenueTrends(revenueData.monthlyStats, period as string);

  return handleQueryResult(c, {
    period,
    currency: currency || getBaseCurrency(c.env),
    trends: trendsData,
    summary: revenueData.summary,
    filters: revenueData.filters
  }, 'Revenue trends');
});

analyticsRoutes.get('/subscription-overview', async (c) => {
  const yearParam = c.req.query('year');
  const monthParam = c.req.query('month');

  const now = new Date();
  const targetYear = yearParam ? Number(yearParam) : now.getFullYear();
  const targetMonth = monthParam ? Number(monthParam) : now.getMonth() + 1;

  const validator = createValidator();
  validator
    .integer(targetYear, 'year')
    .range(targetYear, 'year', 2000, 3000)
    .integer(targetMonth, 'month')
    .range(targetMonth, 'month', 1, 12);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());

  const service = new AnalyticsService(c.env);
  const activeSubscriptions = await service.getMonthlyActiveSubscriptions(targetYear, targetMonth);

  const monthStr = String(targetMonth).padStart(2, '0');
  const startDate = `${targetYear}-${monthStr}-01`;
  const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

  const revenueData = await service.getMonthlyRevenue({ start_date: startDate, end_date: endDate });

  const result = {
    period: {
      year: targetYear,
      month: targetMonth,
      monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
    },
    subscriptions: activeSubscriptions,
    revenue: revenueData,
    overview: {
      totalActiveSubscriptions: activeSubscriptions.summary.totalActiveSubscriptions,
      totalRevenue: activeSubscriptions.summary.totalRevenue,
      averageRevenuePerSubscription: activeSubscriptions.summary.totalActiveSubscriptions > 0
        ? Math.round((activeSubscriptions.summary.totalRevenue / activeSubscriptions.summary.totalActiveSubscriptions) * 100) / 100
        : 0,
      topCategories: getTopCategories(activeSubscriptions.summary.byCategory),
      currencyDistribution: activeSubscriptions.summary.byCurrency
    }
  };

  return handleQueryResult(c, result, 'Subscription overview');
});

function aggregateRevenueTrends(monthlyStats: Array<Record<string, unknown>>, period: string) {
  if (period === 'monthly') return monthlyStats;

  const aggregated: Record<string, { period: string; currency: string; totalRevenue: number; paymentCount: number; averagePayment: number }> = {};

  monthlyStats.forEach((stat) => {
    const [year, month] = String(stat.month).split('-');
    let key = '';
    if (period === 'quarterly') {
      const quarter = Math.ceil(Number(month) / 3);
      key = `${year}-Q${quarter}`;
    } else if (period === 'yearly') {
      key = year;
    }

    if (!aggregated[key]) {
      aggregated[key] = {
        period: key,
        currency: String(stat.currency),
        totalRevenue: 0,
        paymentCount: 0,
        averagePayment: 0
      };
    }

    aggregated[key].totalRevenue += Number(stat.totalRevenue || 0);
    aggregated[key].paymentCount += Number(stat.paymentCount || 0);
  });

  Object.values(aggregated).forEach((item) => {
    item.averagePayment = item.paymentCount > 0 ? Math.round((item.totalRevenue / item.paymentCount) * 100) / 100 : 0;
  });

  return Object.values(aggregated).sort((a, b) => b.period.localeCompare(a.period));
}

function getTopCategories(categoryData: Record<string, { count: number; revenue: number }>, limit = 5) {
  return Object.entries(categoryData)
    .map(([category, data]) => ({ category, count: data.count, revenue: data.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}
