import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { PaymentHistoryService } from '../services/paymentHistoryService';
import { createValidator } from '../utils/validator';
import { isSupportedCurrency } from '../config/currencies';
import { handleDbResult, handleQueryResult, validationError } from '../utils/response';
import { requireLogin } from '../middleware/requireLogin';

export const paymentHistoryRoutes = new Hono<HonoEnv>();
export const protectedPaymentHistoryRoutes = new Hono<HonoEnv>();

paymentHistoryRoutes.get('/', async (c) => {
  const { subscription_id, start_date, end_date, status, currency, limit = '50', offset = '0' } = c.req.query();
  const filters: Record<string, unknown> = {};
  if (subscription_id) filters.subscription_id = subscription_id;
  if (start_date) filters.start_date = start_date;
  if (end_date) filters.end_date = end_date;
  if (status) filters.status = status;
  if (currency) filters.currency = currency;

  const service = new PaymentHistoryService(c.env);
  const result = await service.getPaymentHistory(filters, { limit: Number(limit), offset: Number(offset) });
  return handleQueryResult(c, result, 'Payment history');
});

paymentHistoryRoutes.get('/stats/monthly', async (c) => {
  const year = Number(c.req.query('year'));
  const month = Number(c.req.query('month'));
  const validator = createValidator();
  validator.required(year, 'year').integer(year, 'year').range(year, 'year', 2000, 3000)
    .required(month, 'month').integer(month, 'month').range(month, 'month', 1, 12);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());
  const service = new PaymentHistoryService(c.env);
  const stats = await service.getMonthlyStats(year, month);
  return handleQueryResult(c, stats, 'Monthly payment statistics');
});

paymentHistoryRoutes.get('/stats/yearly', async (c) => {
  const year = Number(c.req.query('year'));
  const validator = createValidator();
  validator.required(year, 'year').integer(year, 'year').range(year, 'year', 2000, 3000);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());
  const service = new PaymentHistoryService(c.env);
  const stats = await service.getYearlyStats(year);
  return handleQueryResult(c, stats, 'Yearly payment statistics');
});

paymentHistoryRoutes.get('/stats/quarterly', async (c) => {
  const year = Number(c.req.query('year'));
  const quarter = Number(c.req.query('quarter'));
  const validator = createValidator();
  validator.required(year, 'year').integer(year, 'year').range(year, 'year', 2000, 3000)
    .required(quarter, 'quarter').integer(quarter, 'quarter').range(quarter, 'quarter', 1, 4);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());
  const service = new PaymentHistoryService(c.env);
  const stats = await service.getQuarterlyStats(year, quarter);
  return handleQueryResult(c, stats, 'Quarterly payment statistics');
});

paymentHistoryRoutes.get('/:id', async (c) => {
  const service = new PaymentHistoryService(c.env);
  const result = await service.getPaymentById(Number(c.req.param('id')));
  return handleQueryResult(c, result, 'Payment record');
});

protectedPaymentHistoryRoutes.use('*', requireLogin);

protectedPaymentHistoryRoutes.post('/', async (c) => {
  const payload = await c.req.json();
  const transformed = transformPaymentData(payload);
  const validator = validatePaymentData(c.env, transformed, true);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());
  const service = new PaymentHistoryService(c.env);
  const result = await service.createPayment(transformed);
  return handleDbResult(c, result, 'create', 'Payment record');
});

protectedPaymentHistoryRoutes.put('/:id', async (c) => {
  const payload = await c.req.json();
  const transformed = transformPaymentData(payload);
  const validator = validatePaymentData(c.env, transformed, false);
  if (validator.hasErrors()) return validationError(c, validator.getErrors());
  const service = new PaymentHistoryService(c.env);
  const result = await service.updatePayment(Number(c.req.param('id')), transformed);
  return handleDbResult(c, result, 'update', 'Payment record');
});

protectedPaymentHistoryRoutes.delete('/:id', async (c) => {
  const service = new PaymentHistoryService(c.env);
  const result = await service.deletePayment(Number(c.req.param('id')));
  return handleDbResult(c, result, 'delete', 'Payment record');
});

protectedPaymentHistoryRoutes.post('/bulk', async (c) => {
  const payload = await c.req.json();
  if (!Array.isArray(payload)) return validationError(c, 'Request body must be an array of payment records');

  const transformed: Record<string, unknown>[] = [];
  for (let i = 0; i < payload.length; i += 1) {
    const data = transformPaymentData(payload[i]);
    const validator = validatePaymentData(c.env, data, true);
    if (validator.hasErrors()) {
      return validationError(c, `Record ${i + 1}: ${validator.getErrors().map((e) => e.message).join(', ')}`);
    }
    transformed.push(data);
  }

  const service = new PaymentHistoryService(c.env);
  const result = await service.bulkCreatePayments(transformed);
  return handleQueryResult(c, result, 'Payment records');
});

protectedPaymentHistoryRoutes.post('/recalculate', async (c) => {
  const service = new PaymentHistoryService(c.env);
  await service.recalculateMonthlyCategorySummaries();
  return handleQueryResult(c, { message: 'Monthly expenses recalculated successfully' }, 'Recalculation result');
});

function validatePaymentData(env: HonoEnv['Bindings'], data: Record<string, unknown>, isCreate = true) {
  const validator = createValidator();
  if (isCreate) {
    validator
      .required(data.subscription_id, 'subscription_id')
      .required(data.payment_date, 'payment_date')
      .required(data.amount_paid, 'amount_paid')
      .required(data.currency, 'currency');
  }

  validator
    .integer(data.subscription_id, 'subscription_id')
    .date(data.payment_date, 'payment_date')
    .number(data.amount_paid, 'amount_paid')
    .range(data.amount_paid, 'amount_paid', 0)
    .string(data.currency, 'currency')
    .length(data.currency, 'currency', 3, 3)
    .custom(data.currency, 'currency', (value) => isSupportedCurrency(env, String(value)), 'Currency is not supported')
    .date(data.billing_period_start, 'billing_period_start')
    .date(data.billing_period_end, 'billing_period_end')
    .enum(data.status, 'status', ['succeeded', 'failed', 'pending', 'cancelled', 'refunded'])
    .string(data.notes, 'notes');

  return validator;
}

function transformPaymentData(data: Record<string, unknown>) {
  const fieldMapping: Record<string, string> = {
    subscriptionId: 'subscription_id',
    paymentDate: 'payment_date',
    amountPaid: 'amount_paid',
    billingPeriodStart: 'billing_period_start',
    billingPeriodEnd: 'billing_period_end'
  };

  const transformed: Record<string, unknown> = {};
  Object.keys(data || {}).forEach((key) => {
    const dbField = fieldMapping[key] || key;
    transformed[dbField] = data[key];
  });
  return transformed;
}
