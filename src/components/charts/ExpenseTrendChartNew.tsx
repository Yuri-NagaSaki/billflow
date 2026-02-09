import { TrendChart } from './TrendChart'
import { MonthlyExpense } from "@/lib/expense-analytics-api"
import { TrendDataPoint } from '@/types'

interface ExpenseTrendChartProps {
  data: MonthlyExpense[]
  categoryData?: CategoryExpenseData[]
  currency: string
  className?: string
}

interface CategoryExpenseData {
  month: string
  monthKey: string
  year: number
  categories: {
    [categoryName: string]: number
  }
  total: number
}

export function ExpenseTrendChart({ 
  data, 
  categoryData,
  currency,
  className 
}: ExpenseTrendChartProps) {
  // Transform data to TrendDataPoint format
  const trendData: TrendDataPoint[] = categoryData 
    ? categoryData.map(item => ({
        period: item.month,
        amount: item.total,
        ...item.categories
      }))
    : data.map(item => ({
        period: item.month,
        amount: item.amount
      }))

  return (
    <div className={className}>
      <TrendChart
        title="Monthly Expense Trend"
        description="Your subscription expenses over the past 12 months"
        data={trendData}
        period="monthly"
        currency={currency}
        showCategories={!!categoryData}
      />
    </div>
  )
}