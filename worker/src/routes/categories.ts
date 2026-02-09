import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { createValidator } from '../utils/validator';
import { handleDbResult, handleQueryResult, validationError } from '../utils/response';
import { requireLogin } from '../middleware/requireLogin';
import { dbAll, dbRun, dbFirst, normalizeResult } from '../utils/db';

export const categoriesRoutes = new Hono<HonoEnv>();
export const protectedCategoriesRoutes = new Hono<HonoEnv>();

categoriesRoutes.get('/', async (c) => {
  const categories = await dbAll<Record<string, unknown>>(c.env.DB, 'SELECT * FROM categories ORDER BY label ASC');
  return handleQueryResult(c, categories, 'Categories');
});

protectedCategoriesRoutes.use('*', requireLogin);

protectedCategoriesRoutes.post('/', async (c) => {
  const payload = await c.req.json();
  const { value, label } = payload || {};
  const validator = createValidator();
  validator
    .required(value, 'value')
    .string(value, 'value')
    .length(value, 'value', 1, 50)
    .required(label, 'label')
    .string(label, 'label')
    .length(label, 'label', 1, 100);

  if (validator.hasErrors()) {
    return validationError(c, validator.getErrors());
  }

  const exists = await dbFirst<{ count: number }>(
    c.env.DB,
    'SELECT COUNT(*) as count FROM categories WHERE value = ?',
    [value]
  );
  if ((exists?.count || 0) > 0) {
    return validationError(c, 'Category with this value already exists');
  }

  const result = await dbRun(c.env.DB, 'INSERT INTO categories (value, label) VALUES (?, ?)', [value, label]);
  return handleDbResult(c, normalizeResult(result), 'create', 'Category');
});

protectedCategoriesRoutes.put('/:value', async (c) => {
  const payload = await c.req.json();
  const { label } = payload || {};
  const validator = createValidator();
  validator.required(label, 'label').string(label, 'label').length(label, 'label', 1, 100);
  if (validator.hasErrors()) {
    return validationError(c, validator.getErrors());
  }

  const result = await dbRun(c.env.DB, 'UPDATE categories SET label = ? WHERE value = ?', [label, c.req.param('value')]);
  return handleDbResult(c, normalizeResult(result), 'update', 'Category');
});

protectedCategoriesRoutes.delete('/:value', async (c) => {
  const result = await dbRun(c.env.DB, 'DELETE FROM categories WHERE value = ?', [c.req.param('value')]);
  return handleDbResult(c, normalizeResult(result), 'delete', 'Category');
});

export const paymentMethodsRoutes = new Hono<HonoEnv>();
export const protectedPaymentMethodsRoutes = new Hono<HonoEnv>();

paymentMethodsRoutes.get('/', async (c) => {
  const methods = await dbAll<Record<string, unknown>>(c.env.DB, 'SELECT * FROM payment_methods ORDER BY label ASC');
  return handleQueryResult(c, methods, 'Payment methods');
});

protectedPaymentMethodsRoutes.use('*', requireLogin);

protectedPaymentMethodsRoutes.post('/', async (c) => {
  const payload = await c.req.json();
  const { value, label } = payload || {};
  const validator = createValidator();
  validator
    .required(value, 'value')
    .string(value, 'value')
    .length(value, 'value', 1, 50)
    .required(label, 'label')
    .string(label, 'label')
    .length(label, 'label', 1, 100);

  if (validator.hasErrors()) {
    return validationError(c, validator.getErrors());
  }

  const exists = await dbFirst<{ count: number }>(
    c.env.DB,
    'SELECT COUNT(*) as count FROM payment_methods WHERE value = ?',
    [value]
  );
  if ((exists?.count || 0) > 0) {
    return validationError(c, 'Payment method with this value already exists');
  }

  const result = await dbRun(c.env.DB, 'INSERT INTO payment_methods (value, label) VALUES (?, ?)', [value, label]);
  return handleDbResult(c, normalizeResult(result), 'create', 'Payment method');
});

protectedPaymentMethodsRoutes.put('/:value', async (c) => {
  const payload = await c.req.json();
  const { label } = payload || {};
  const validator = createValidator();
  validator.required(label, 'label').string(label, 'label').length(label, 'label', 1, 100);
  if (validator.hasErrors()) {
    return validationError(c, validator.getErrors());
  }

  const result = await dbRun(c.env.DB, 'UPDATE payment_methods SET label = ? WHERE value = ?', [label, c.req.param('value')]);
  return handleDbResult(c, normalizeResult(result), 'update', 'Payment method');
});

protectedPaymentMethodsRoutes.delete('/:value', async (c) => {
  const result = await dbRun(c.env.DB, 'DELETE FROM payment_methods WHERE value = ?', [c.req.param('value')]);
  return handleDbResult(c, normalizeResult(result), 'delete', 'Payment method');
});
