export const SUPPORTED_NOTIFICATION_TYPES = [
  'renewal_reminder',
  'expiration_warning',
  'renewal_success',
  'renewal_failure',
  'subscription_change'
];

export const SUPPORTED_CHANNELS = ['telegram'] as const;

export const DEFAULT_NOTIFICATION_CHANNELS = ['telegram'];
