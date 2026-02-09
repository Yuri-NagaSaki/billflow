import type { Env } from '../types';
import { isSupportedCurrency } from '../config/currencies';

export class Validator {
  errors: { field: string; message: string }[] = [];

  reset() {
    this.errors = [];
    return this;
  }

  addError(field: string, message: string) {
    this.errors.push({ field, message });
    return this;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  getErrors() {
    return this.errors;
  }

  required(value: unknown, field: string) {
    if (value === undefined || value === null || value === '') {
      this.addError(field, `${field} is required`);
    }
    return this;
  }

  string(value: unknown, field: string) {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      this.addError(field, `${field} must be a string`);
    }
    return this;
  }

  number(value: unknown, field: string) {
    if (value !== undefined && value !== null && (typeof value !== 'number' || Number.isNaN(value))) {
      this.addError(field, `${field} must be a number`);
    }
    return this;
  }

  integer(value: unknown, field: string) {
    if (value !== undefined && value !== null && !Number.isInteger(Number(value))) {
      this.addError(field, `${field} must be an integer`);
    }
    return this;
  }

  boolean(value: unknown, field: string) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'boolean') return this;
      if (value === 0 || value === 1) return this;
      if (value === '0' || value === '1' || value === 'true' || value === 'false') return this;
      this.addError(field, `${field} must be a boolean (true/false) or integer boolean (0/1)`);
    }
    return this;
  }

  url(value: unknown, field: string) {
    if (value && typeof value === 'string') {
      try {
        new URL(value);
      } catch {
        this.addError(field, `${field} must be a valid URL`);
      }
    }
    return this;
  }

  date(value: unknown, field: string) {
    if (value && typeof value === 'string') {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        this.addError(field, `${field} must be a valid date`);
      }
    }
    return this;
  }

  length(value: unknown, field: string, min = 0, max = Infinity) {
    if (value && typeof value === 'string') {
      if (value.length < min) this.addError(field, `${field} must be at least ${min} characters long`);
      if (value.length > max) this.addError(field, `${field} must be no more than ${max} characters long`);
    }
    return this;
  }

  range(value: unknown, field: string, min = -Infinity, max = Infinity) {
    if (value !== undefined && value !== null) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        if (num < min) this.addError(field, `${field} must be at least ${min}`);
        if (num > max) this.addError(field, `${field} must be no more than ${max}`);
      }
    }
    return this;
  }

  enum(value: unknown, field: string, allowedValues: string[]) {
    if (value !== undefined && value !== null && !allowedValues.includes(value as string)) {
      this.addError(field, `${field} must be one of: ${allowedValues.join(', ')}`);
    }
    return this;
  }

  array(value: unknown, field: string) {
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      this.addError(field, `${field} must be an array`);
    }
    return this;
  }

  object(value: unknown, field: string) {
    if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value))) {
      this.addError(field, `${field} must be an object`);
    }
    return this;
  }

  custom(value: unknown, field: string, validatorFn: (val: unknown) => boolean, message: string) {
    if (value !== undefined && value !== null && !validatorFn(value)) {
      this.addError(field, message || `${field} is invalid`);
    }
    return this;
  }
}

export function createValidator() {
  return new Validator();
}

export function validateSubscription(env: Env, data: Record<string, unknown>) {
  const validator = createValidator();

  validator
    .required(data.name, 'name')
    .string(data.name, 'name')
    .length(data.name, 'name', 1, 255)

    .required(data.plan, 'plan')
    .string(data.plan, 'plan')
    .length(data.plan, 'plan', 1, 255)

    .required(data.billing_cycle, 'billing_cycle')
    .enum(data.billing_cycle, 'billing_cycle', ['monthly', 'yearly', 'quarterly', 'semiannual'])

    .required(data.amount, 'amount')
    .number(data.amount, 'amount')
    .range(data.amount, 'amount', 0)

    .required(data.currency, 'currency')
    .string(data.currency, 'currency')
    .length(data.currency, 'currency', 3, 3)
    .custom(data.currency, 'currency', (value) => isSupportedCurrency(env, String(value)), 'Currency is not supported')

    .required(data.payment_method_id, 'payment_method_id')
    .integer(data.payment_method_id, 'payment_method_id')
    .range(data.payment_method_id, 'payment_method_id', 1)

    .date(data.next_billing_date, 'next_billing_date')
    .date(data.start_date, 'start_date')

    .enum(data.status, 'status', ['active', 'trial', 'cancelled'])
    .enum(data.renewal_type, 'renewal_type', ['auto', 'manual'])

    .required(data.category_id, 'category_id')
    .integer(data.category_id, 'category_id')
    .range(data.category_id, 'category_id', 1)

    .string(data.notes, 'notes')
    .url(data.website, 'website');

  return validator;
}

export async function validateSubscriptionWithForeignKeys(env: Env, db: D1Database, data: Record<string, unknown>) {
  const validator = validateSubscription(env, data);

  if (data.category_id !== undefined && data.category_id !== null) {
    const category = await db.prepare('SELECT COUNT(*) as count FROM categories WHERE id = ?').bind(data.category_id).first<{ count: number }>();
    validator.custom(data.category_id, 'category_id', () => (category?.count || 0) > 0, `Category with id ${data.category_id} does not exist`);
  }

  if (data.payment_method_id !== undefined && data.payment_method_id !== null) {
    const paymentMethod = await db.prepare('SELECT COUNT(*) as count FROM payment_methods WHERE id = ?').bind(data.payment_method_id).first<{ count: number }>();
    validator.custom(data.payment_method_id, 'payment_method_id', () => (paymentMethod?.count || 0) > 0, `Payment method with id ${data.payment_method_id} does not exist`);
  }

  return validator;
}

export function validateChannelConfig(data: Record<string, unknown>) {
  const validator = createValidator();
  const channelType = data.channel_type as string | undefined;

  validator
    .required(channelType, 'channel_type')
    .string(channelType, 'channel_type')
    .enum(channelType, 'channel_type', ['telegram']);

  validator
    .required(data.config, 'config')
    .object(data.config, 'config');

  if (channelType === 'telegram' && data.config && typeof data.config === 'object') {
    const config = data.config as Record<string, unknown>;
    validator
      .required(config.chat_id, 'config.chat_id')
      .string(config.chat_id, 'config.chat_id')
      .custom(config.chat_id, 'config.chat_id', (chatId) => /^-?\d+$/.test(String(chatId)), 'Telegram chat_id must be a valid number string');
  }

  return validator;
}

export function validateSendNotification(data: Record<string, unknown>) {
  const validator = createValidator();

  validator
    .required(data.subscription_id, 'subscription_id')
    .integer(data.subscription_id, 'subscription_id')
    .range(data.subscription_id, 'subscription_id', 1)

    .required(data.notification_type, 'notification_type')
    .string(data.notification_type, 'notification_type')
    .enum(data.notification_type, 'notification_type', [
      'renewal_reminder',
      'expiration_warning',
      'renewal_success',
      'renewal_failure',
      'subscription_change'
    ])

    .array(data.channels, 'channels')
    .custom(data.channels, 'channels', (channels) => !channels || (Array.isArray(channels) && channels.every((channel) => ['telegram'].includes(String(channel)))), 'channels must contain only valid channel types: telegram');

  return validator;
}
