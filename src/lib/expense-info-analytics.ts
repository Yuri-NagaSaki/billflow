import { MonthlyExpense } from './expense-analytics-api'
import { ExpenseInfoData } from '@/components/charts/ExpenseInfoCards'

/**
 * Calculate days in a given month and year
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Calculate days in a quarter
 */
function getDaysInQuarter(year: number, quarter: number): number {
  const months = [
    [1, 2, 3],    // Q1
    [4, 5, 6],    // Q2
    [7, 8, 9],    // Q3
    [10, 11, 12]  // Q4
  ]
  
  const quarterMonths = months[quarter - 1]
  return quarterMonths.reduce((total, month) => total + getDaysInMonth(year, month), 0)
}

/**
 * Calculate days in a year
 */
function getDaysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365
}

/**
 * Format period display name
 */
function formatPeriodName(type: 'monthly' | 'quarterly' | 'yearly', year: number, period: number): string {
  switch (type) {
    case 'monthly':
      return new Date(year, period - 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      })
    case 'quarterly': {
      const quarterMonths = [
        'Jan - Mar',  // Q1
        'Apr - Jun',  // Q2
        'Jul - Sep',  // Q3
        'Oct - Dec'   // Q4
      ]
      return `Q${period} ${year} (${quarterMonths[period - 1]})`
    }
    case 'yearly':
      return year.toString()
    default:
      return `${year}-${period}`
  }
}

/**
 * Get date range for a period
 */
function getPeriodDateRange(type: 'monthly' | 'quarterly' | 'yearly', year: number, period: number) {
  // Helper function to format date as YYYY-MM-DD without timezone issues
  const formatDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  switch (type) {
    case 'monthly': {
      // 月初：当前月的第1天
      const monthStart = new Date(year, period - 1, 1)
      // 月末：下个月的第0天（即当前月的最后一天）
      const monthEnd = new Date(year, period, 0)
      return {
        startDate: formatDate(monthStart),
        endDate: formatDate(monthEnd)
      }
    }
    case 'quarterly': {
      const quarterStartMonth = (period - 1) * 3
      const quarterStart = new Date(year, quarterStartMonth, 1)
      const quarterEnd = new Date(year, quarterStartMonth + 3, 0)
      return {
        startDate: formatDate(quarterStart),
        endDate: formatDate(quarterEnd)
      }
    }
    case 'yearly':
      return {
        startDate: formatDate(new Date(year, 0, 1)),
        endDate: formatDate(new Date(year, 11, 31))
      }
  }
}

/**
 * Convert monthly expenses to ExpenseInfoData format
 */
export function convertMonthlyExpensesToInfo(
  monthlyExpenses: MonthlyExpense[],
  currency: string
): ExpenseInfoData[] {
  return monthlyExpenses.map(expense => {
    const [year, month] = expense.monthKey.split('-').map(Number)
    const daysInMonth = getDaysInMonth(year, month)
    const { startDate, endDate } = getPeriodDateRange('monthly', year, month)
    
    return {
      period: formatPeriodName('monthly', year, month),
      periodType: 'monthly' as const,
      totalSpent: expense.amount,
      dailyAverage: expense.amount / daysInMonth,
      activeSubscriptions: expense.subscriptionCount,
      paymentCount: expense.paymentHistoryIds?.length || 0,
      startDate,
      endDate,
      currency
    }
  })
}

/**
 * Calculate quarterly expenses from monthly data
 */
export function calculateQuarterlyExpenses(
  monthlyExpenses: MonthlyExpense[],
  currency: string
): ExpenseInfoData[] {
  const quarterlyMap = new Map<string, {
    totalSpent: number
    subscriptions: Set<number>
    paymentCount: number
    year: number
    quarter: number
  }>()

  monthlyExpenses.forEach(expense => {
    const [year, month] = expense.monthKey.split('-').map(Number)
    const quarter = Math.ceil(month / 3)
    const quarterKey = `${year}-Q${quarter}`

    if (!quarterlyMap.has(quarterKey)) {
      quarterlyMap.set(quarterKey, {
        totalSpent: 0,
        subscriptions: new Set(),
        paymentCount: 0,
        year,
        quarter
      })
    }

    const quarterData = quarterlyMap.get(quarterKey)!
    quarterData.totalSpent += expense.amount
    quarterData.paymentCount += expense.paymentHistoryIds?.length || 0

    // Note: We can't accurately track unique subscriptions across quarters from monthly data
    // This is an approximation - in a real implementation, you'd want to query the database
    quarterData.subscriptions.add(expense.subscriptionCount)
  })

  return Array.from(quarterlyMap.entries()).map(([, data]) => {
    const daysInQuarter = getDaysInQuarter(data.year, data.quarter)
    const { startDate, endDate } = getPeriodDateRange('quarterly', data.year, data.quarter)

    return {
      period: formatPeriodName('quarterly', data.year, data.quarter),
      periodType: 'quarterly' as const,
      totalSpent: data.totalSpent,
      dailyAverage: data.totalSpent / daysInQuarter,
      activeSubscriptions: Math.max(...Array.from(data.subscriptions)), // Approximation
      paymentCount: data.paymentCount,
      startDate,
      endDate,
      currency
    }
  }).sort((a, b) => {
    const [aYear, aQuarter] = a.period.split(' ')
    const [bYear, bQuarter] = b.period.split(' ')
    if (aYear !== bYear) return parseInt(bYear) - parseInt(aYear)
    return parseInt(bQuarter.replace('Q', '')) - parseInt(aQuarter.replace('Q', ''))
  })
}

/**
 * Calculate yearly expenses from monthly data
 */
export function calculateYearlyExpenses(
  monthlyExpenses: MonthlyExpense[],
  currency: string
): ExpenseInfoData[] {
  const yearlyMap = new Map<number, {
    totalSpent: number
    subscriptions: Set<number>
    paymentCount: number
  }>()

  monthlyExpenses.forEach(expense => {
    const [year] = expense.monthKey.split('-').map(Number)

    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, {
        totalSpent: 0,
        subscriptions: new Set(),
        paymentCount: 0
      })
    }

    const yearData = yearlyMap.get(year)!
    yearData.totalSpent += expense.amount
    yearData.paymentCount += expense.paymentHistoryIds?.length || 0

    // Note: Same approximation issue as quarterly data
    yearData.subscriptions.add(expense.subscriptionCount)
  })

  return Array.from(yearlyMap.entries()).map(([year, data]) => {
    const daysInYear = getDaysInYear(year)
    const { startDate, endDate } = getPeriodDateRange('yearly', year, 1)

    return {
      period: formatPeriodName('yearly', year, 1),
      periodType: 'yearly' as const,
      totalSpent: data.totalSpent,
      dailyAverage: data.totalSpent / daysInYear,
      activeSubscriptions: Math.max(...Array.from(data.subscriptions)), // Approximation
      paymentCount: data.paymentCount,
      startDate,
      endDate,
      currency
    }
  }).sort((a, b) => parseInt(b.period) - parseInt(a.period))
}

/**
 * Get recent periods for display
 */
export function getRecentPeriods() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentQuarter = Math.ceil(currentMonth / 3)

  return {
    // Last 6 months (including current month)
    monthlyPeriods: Array.from({ length: 6 }, (_, i) => {
      // Date's month parameter is 0-based; currentMonth is 1-based
      const date = new Date(currentYear, (currentMonth - 1) - i, 1)
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }
    }).reverse(), // Reverse to show chronological order (oldest to newest)
    
    // Last 4 quarters
    quarterlyPeriods: Array.from({ length: 4 }, (_, i) => {
      const quarterOffset = i
      let year = currentYear
      let quarter = currentQuarter - quarterOffset
      
      if (quarter <= 0) {
        year -= Math.ceil(Math.abs(quarter) / 4)
        quarter = 4 + (quarter % 4)
      }
      
      return { year, quarter }
    }),
    
    // Last 3 years
    yearlyPeriods: Array.from({ length: 3 }, (_, i) => ({
      year: currentYear - i
    }))
  }
}

/**
 * Filter monthly expenses by recent periods
 */
export function filterRecentExpenses(monthlyExpenses: MonthlyExpense[]) {
  const { monthlyPeriods, quarterlyPeriods, yearlyPeriods } = getRecentPeriods()

  const recentMonthKeys = new Set(monthlyPeriods.map(p => p.monthKey))
  const recentYears = new Set(yearlyPeriods.map(p => p.year))

  // 为季度数据生成所有需要的月份键
  const quarterlyMonthKeys = new Set<string>()
  quarterlyPeriods.forEach(({ year, quarter }) => {
    const months = [
      [1, 2, 3],    // Q1
      [4, 5, 6],    // Q2
      [7, 8, 9],    // Q3
      [10, 11, 12]  // Q4
    ]
    const quarterMonths = months[quarter - 1]
    quarterMonths.forEach(month => {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      quarterlyMonthKeys.add(monthKey)
    })
  })

  return {
    monthlyExpenses: monthlyExpenses.filter(expense =>
      recentMonthKeys.has(expense.monthKey)
    ),
    quarterlyExpenses: monthlyExpenses.filter(expense =>
      quarterlyMonthKeys.has(expense.monthKey)
    ),
    yearlyExpenses: monthlyExpenses.filter(expense => {
      const [year] = expense.monthKey.split('-').map(Number)
      return recentYears.has(year)
    })
  }
}
