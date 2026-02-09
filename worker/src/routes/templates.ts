import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { getTemplate, getSupportedChannels, getSupportedLanguages, getSupportedNotificationTypes } from '../config/notificationTemplates';
import { validationError, handleQueryResult } from '../utils/response';

export const templateRoutes = new Hono<HonoEnv>();

templateRoutes.get('/languages', async (c) => {
  return handleQueryResult(c, getSupportedLanguages(), 'Supported languages');
});

templateRoutes.get('/types', async (c) => {
  return handleQueryResult(c, getSupportedNotificationTypes(), 'Supported notification types');
});

templateRoutes.get('/channels', async (c) => {
  const notificationType = c.req.query('notificationType');
  const language = c.req.query('language') || 'zh-CN';
  if (!notificationType) return validationError(c, 'notificationType is required');
  const channels = getSupportedChannels(notificationType, language);
  return handleQueryResult(c, channels, 'Supported channels');
});

templateRoutes.get('/template', async (c) => {
  const notificationType = c.req.query('notificationType');
  const language = c.req.query('language') || 'zh-CN';
  const channel = c.req.query('channel') || 'telegram';
  if (!notificationType) return validationError(c, 'notificationType is required');
  const template = getTemplate(notificationType, language, channel);
  if (!template) return c.json({ success: false, error: 'Template not found' }, 404);
  return handleQueryResult(c, template, 'Template');
});

templateRoutes.get('/overview', async (c) => {
  const types = getSupportedNotificationTypes();
  const languages = getSupportedLanguages();

  const overview = types.map((type) => {
    const languageChannels: Record<string, string[]> = {};
    languages.forEach((lang) => {
      const channels = getSupportedChannels(type, lang);
      if (channels.length > 0) languageChannels[lang] = channels;
    });

    return {
      notificationType: type,
      supportedLanguages: Object.keys(languageChannels),
      languageChannels
    };
  });

  return handleQueryResult(c, { overview, totalTypes: types.length, totalLanguages: languages.length }, 'Template overview');
});

templateRoutes.post('/preview', async (c) => {
  const payload = await c.req.json();
  const { notificationType, language = 'zh-CN', channel = 'telegram', sampleData = {} } = payload || {};

  if (!notificationType) return validationError(c, 'notificationType is required');

  const template = getTemplate(notificationType, language, channel);
  if (!template) return c.json({ success: false, error: 'Template not found' }, 404);

  const defaultSampleData = {
    name: 'Netflix',
    plan: 'Premium',
    amount: '15.99',
    currency: 'USD',
    next_billing_date: '2024-01-15',
    payment_method: 'Credit Card',
    status: 'active',
    billing_cycle: 'monthly'
  };

  const templateData = { ...defaultSampleData, ...sampleData };

  let content = template.content_template || '';
  let subject = template.subject_template || '';

  Object.keys(templateData).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    content = content.replace(regex, templateData[key]);
    if (subject) subject = subject.replace(regex, templateData[key]);
  });

  return handleQueryResult(c, { template, renderedContent: content, renderedSubject: subject, sampleData: templateData }, 'Template preview');
});
