export function calculateLastBillingDate(nextBillingDate: string, startDate: string, billingCycle: string) {
  const nextDate = new Date(nextBillingDate);
  const startDateObj = new Date(startDate);
  let lastBillingDate: Date | null = null;

  switch (billingCycle) {
    case 'monthly':
      lastBillingDate = new Date(nextDate);
      lastBillingDate.setMonth(lastBillingDate.getMonth() - 1);
      break;
    case 'semiannual':
      lastBillingDate = new Date(nextDate);
      lastBillingDate.setMonth(lastBillingDate.getMonth() - 6);
      break;
    case 'yearly':
      lastBillingDate = new Date(nextDate);
      lastBillingDate.setFullYear(lastBillingDate.getFullYear() - 1);
      break;
    case 'quarterly':
      lastBillingDate = new Date(nextDate);
      lastBillingDate.setMonth(lastBillingDate.getMonth() - 3);
      break;
    default:
      return null;
  }

  if (lastBillingDate < startDateObj) {
    lastBillingDate = startDateObj;
  }

  return lastBillingDate.toISOString().split('T')[0];
}

export function calculateNextBillingDate(currentDate: string, billingCycle: string) {
  const baseDate = new Date(currentDate);
  let nextBillingDate: Date;

  switch (billingCycle) {
    case 'monthly':
      nextBillingDate = new Date(baseDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      break;
    case 'semiannual':
      nextBillingDate = new Date(baseDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 6);
      break;
    case 'yearly':
      nextBillingDate = new Date(baseDate);
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      break;
    case 'quarterly':
      nextBillingDate = new Date(baseDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);
      break;
    default:
      throw new Error('Invalid billing cycle');
  }

  return nextBillingDate.toISOString().split('T')[0];
}

export function calculateNextBillingDateFromStart(startDate: string, currentDate: string, billingCycle: string) {
  const today = new Date(currentDate);
  const start = new Date(startDate);
  let nextBilling = new Date(start);

  while (nextBilling <= today) {
    switch (billingCycle) {
      case 'monthly':
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        break;
      case 'semiannual':
        nextBilling.setMonth(nextBilling.getMonth() + 6);
        break;
      case 'yearly':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        break;
      case 'quarterly':
        nextBilling.setMonth(nextBilling.getMonth() + 3);
        break;
      default:
        throw new Error('Invalid billing cycle');
    }
  }

  return nextBilling.toISOString().split('T')[0];
}

export function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function isDateDueOrOverdue(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);

  return targetDate <= today;
}
