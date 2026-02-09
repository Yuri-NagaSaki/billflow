import { useMemo } from 'react'
import { useSubscriptionStore } from './subscriptionStore'
import { useSettingsStore } from './settingsStore'
import { convertCurrency } from '@/utils/currency'
import { startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns'

interface MonthlyExpenseData {
  month: string
  total: number
  categories: Array<{
    category: string
    amount: number
  }>
}

export const useMonthlyExpenses = (months: number = 12) => {
  const subscriptions = useSubscriptionStore(state => state.subscriptions)
  const categories = useSubscriptionStore(state => state.categories)
  const userCurrency = useSettingsStore(state => state.currency)
  
  return useMemo(() => {
    const monthlyData: MonthlyExpenseData[] = []
    const today = new Date()
    
    // Generate data for each month
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)
      const monthKey = format(monthDate, 'MMM yyyy')
      
      // Track expenses by category for this month
      const categoryExpenses: Record<string, number> = {}
      let monthTotal = 0
      
      // Calculate expenses for active subscriptions in this month
      subscriptions.forEach(sub => {
        if (sub.status !== 'active') return
        
        const startDate = new Date(sub.startDate)
        const nextBillingDate = new Date(sub.nextBillingDate)
        
        // Check if subscription was active during this month
        if (startDate > monthEnd) return
        
        // Calculate if subscription was billed in this month
        let wasBilledThisMonth = false
        const tempDate = new Date(startDate)
        
        while (tempDate <= monthEnd) {
          if (isWithinInterval(tempDate, { start: monthStart, end: monthEnd })) {
            wasBilledThisMonth = true
            break
          }
          
          // Move to next billing date
          switch (sub.billingCycle) {
            case 'monthly':
              tempDate.setMonth(tempDate.getMonth() + 1)
              break
            case 'quarterly':
              tempDate.setMonth(tempDate.getMonth() + 3)
              break
            case 'yearly':
              tempDate.setFullYear(tempDate.getFullYear() + 1)
              break
          }
          
          if (tempDate > nextBillingDate) break
        }
        
        if (wasBilledThisMonth) {
          const convertedAmount = convertCurrency(sub.amount, sub.currency, userCurrency)
          const category = categories.find(cat => cat.id === sub.categoryId)
          const categoryName = category?.label || 'Other'
          
          categoryExpenses[categoryName] = (categoryExpenses[categoryName] || 0) + convertedAmount
          monthTotal += convertedAmount
        }
      })
      
      monthlyData.push({
        month: monthKey,
        total: monthTotal,
        categories: Object.entries(categoryExpenses).map(([category, amount]) => ({
          category,
          amount
        }))
      })
    }
    
    return monthlyData
  }, [subscriptions, categories, userCurrency, months])
}