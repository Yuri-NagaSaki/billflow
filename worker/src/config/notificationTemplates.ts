const NOTIFICATION_TEMPLATES = {
  renewal_reminder: {
    'zh-CN': {
      telegram: {
        content: `<b>续订提醒</b>

📢 <b>{{name}}</b> 即将到期

📅 到期时间: {{next_billing_date}}
💰 金额: {{amount}} {{currency}}
💳 支付方式: {{payment_method}}
📋 计划: {{plan}}

请及时续订以避免服务中断。`
      }
    },
    en: {
      telegram: {
        content: `<b>Renewal Reminder</b>

📢 <b>{{name}}</b> is about to expire

📅 Expiration date: {{next_billing_date}}
💰 Amount: {{amount}} {{currency}}
💳 Payment method: {{payment_method}}
📋 Plan: {{plan}}

Please renew in time to avoid service interruption.`
      }
    }
  },
  expiration_warning: {
    'zh-CN': {
      telegram: {
        content: `<b>⚠️ 订阅过期警告</b>

🚨 <b>{{name}}</b> 已过期

📅 过期时间: {{next_billing_date}}
💰 金额: {{amount}} {{currency}}
💳 支付方式: {{payment_method}}
📋 计划: {{plan}}

请立即续订以恢复服务。`
      }
    },
    en: {
      telegram: {
        content: `<b>⚠️ Subscription Expiration Warning</b>

🚨 <b>{{name}}</b> has expired

📅 Expiration date: {{next_billing_date}}
💰 Amount: {{amount}} {{currency}}
💳 Payment method: {{payment_method}}
📋 Plan: {{plan}}

Please renew immediately to restore service.`
      }
    }
  },
  renewal_success: {
    'zh-CN': {
      telegram: {
        content: `<b>✅ 续订成功</b>

🎉 <b>{{name}}</b> 续订成功

📅 下次续订: {{next_billing_date}}
💰 金额: {{amount}} {{currency}}
💳 支付方式: {{payment_method}}
📋 计划: {{plan}}

感谢您的续订！`
      }
    },
    en: {
      telegram: {
        content: `<b>✅ Renewal Successful</b>

🎉 <b>{{name}}</b> renewed successfully

📅 Next renewal: {{next_billing_date}}
💰 Amount: {{amount}} {{currency}}
💳 Payment method: {{payment_method}}
📋 Plan: {{plan}}

Thank you for your renewal!`
      }
    }
  },
  renewal_failure: {
    'zh-CN': {
      telegram: {
        content: `<b>❌ 续订失败</b>

⚠️ <b>{{name}}</b> 续订失败

📅 到期时间: {{next_billing_date}}
💰 金额: {{amount}} {{currency}}
💳 支付方式: {{payment_method}}
📋 计划: {{plan}}

请检查支付方式并重试。`
      }
    },
    en: {
      telegram: {
        content: `<b>❌ Renewal Failed</b>

⚠️ <b>{{name}}</b> renewal failed

📅 Expiration date: {{next_billing_date}}
💰 Amount: {{amount}} {{currency}}
💳 Payment method: {{payment_method}}
📋 Plan: {{plan}}

Please check your payment method and try again.`
      }
    }
  },
  subscription_change: {
    'zh-CN': {
      telegram: {
        content: `<b>📝 订阅变更通知</b>

🔄 <b>{{name}}</b> 信息已更新

📅 下次续订: {{next_billing_date}}
💰 金额: {{amount}} {{currency}}
💳 支付方式: {{payment_method}}
📋 计划: {{plan}}

变更已生效。`
      }
    },
    en: {
      telegram: {
        content: `<b>📝 Subscription Change Notification</b>

🔄 <b>{{name}}</b> information updated

📅 Next renewal: {{next_billing_date}}
💰 Amount: {{amount}} {{currency}}
💳 Payment method: {{payment_method}}
📋 Plan: {{plan}}

Changes have taken effect.`
      }
    }
  }
};

export function getTemplate(notificationType: string, language = 'zh-CN', channel = 'telegram') {
  const typeTemplates = (NOTIFICATION_TEMPLATES as Record<string, Record<string, Record<string, { subject?: string; content: string }>>>)[notificationType];
  if (!typeTemplates) return null;

  let langTemplates = typeTemplates[language];
  if (!langTemplates) {
    const fallbackLanguages = ['en', 'zh-CN'];
    for (const fallback of fallbackLanguages) {
      if (fallback !== language && typeTemplates[fallback]) {
        langTemplates = typeTemplates[fallback];
        break;
      }
    }
  }

  if (!langTemplates) return null;
  const channelTemplate = langTemplates[channel];
  if (!channelTemplate) return null;

  return {
    notification_type: notificationType,
    language,
    channel_type: channel,
    subject_template: channelTemplate.subject || null,
    content_template: channelTemplate.content
  };
}

export function getSupportedLanguages() {
  const languages = new Set<string>();
  Object.values(NOTIFICATION_TEMPLATES).forEach((typeTemplates) => {
    Object.keys(typeTemplates).forEach((lang) => languages.add(lang));
  });
  return Array.from(languages);
}

export function getSupportedNotificationTypes() {
  return Object.keys(NOTIFICATION_TEMPLATES);
}

export function getSupportedChannels(notificationType: string, language = 'zh-CN') {
  const typeTemplates = (NOTIFICATION_TEMPLATES as Record<string, Record<string, Record<string, unknown>>>)[notificationType];
  if (!typeTemplates || !typeTemplates[language]) return [];
  return Object.keys(typeTemplates[language]);
}

export { NOTIFICATION_TEMPLATES };
