/**
 * 数据转换工具
 * 统一处理前后端数据格式转换（snake_case <-> camelCase）
 */

// 分类和支付方式的类型定义
export interface Category {
  id: number
  name: string
}

export interface PaymentMethod {
  id: number
  name: string
}

// 支付记录相关类型定义
export interface PaymentRecordApi {
  id: number
  subscription_id: number
  subscription_name: string
  subscription_plan: string
  payment_date: string
  amount_paid: number
  currency: string
  billing_period_start: string
  billing_period_end: string
  status: string
  notes?: string
  created_at?: string
}

export interface PaymentRecord {
  id: number
  subscriptionId: number
  subscriptionName: string
  subscriptionPlan: string
  paymentDate: string
  amountPaid: number
  currency: string
  billingPeriod: {
    start: string
    end: string
  }
  billingCycle?: string
  status: string
  notes?: string
}

/**
 * 将API返回的支付记录数据转换为前端格式
 * @param payment API格式的支付记录
 * @returns 前端格式的支付记录
 */
export const transformPaymentFromApi = (payment: PaymentRecordApi): PaymentRecord => ({
  id: payment.id,
  subscriptionId: payment.subscription_id,
  subscriptionName: payment.subscription_name,
  subscriptionPlan: payment.subscription_plan,
  paymentDate: payment.payment_date,
  amountPaid: payment.amount_paid,
  currency: payment.currency,
  billingPeriod: {
    start: payment.billing_period_start,
    end: payment.billing_period_end
  },
  status: payment.status,
  notes: payment.notes
})

/**
 * 将前端支付记录数据转换为API格式
 * @param payment 前端格式的支付记录
 * @returns API格式的支付记录
 */
export const transformPaymentToApi = (payment: PaymentRecord): Partial<PaymentRecordApi> => ({
  subscription_id: payment.subscriptionId,
  payment_date: payment.paymentDate,
  amount_paid: payment.amountPaid,
  currency: payment.currency,
  billing_period_start: payment.billingPeriod.start,
  billing_period_end: payment.billingPeriod.end,
  status: payment.status,
  notes: payment.notes
})

/**
 * 批量转换API返回的支付记录数组
 * @param payments API格式的支付记录数组
 * @returns 前端格式的支付记录数组
 */
export const transformPaymentsFromApi = (payments: PaymentRecordApi[]): PaymentRecord[] => {
  return payments.map(transformPaymentFromApi)
}

/**
 * 通用的snake_case到camelCase转换函数
 * @param obj 包含snake_case键的对象
 * @returns 包含camelCase键的对象
 */
export const snakeToCamel = (obj: unknown): unknown => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel)
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = snakeToCamel(value)
  }
  return result
}

/**
 * 通用的camelCase到snake_case转换函数
 * @param obj 包含camelCase键的对象
 * @returns 包含snake_case键的对象
 */
export const camelToSnake = (obj: unknown): unknown => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(camelToSnake)
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    result[snakeKey] = camelToSnake(value)
  }
  return result
}
