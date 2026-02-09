import { TrendChart } from './TrendChart'
import { TrendDataPoint } from '@/types'

interface YearlyExpenseData {
  year: string
  totalExpense: number
  categories?: {
    [categoryName: string]: number
  }
}

interface YearlyTrendChartProps {
  data: YearlyExpenseData[]
  currency: string
  className?: string
  showCategories?: boolean
}

export function YearlyTrendChart({ 
  data, 
  currency,
  className,
  showCategories = false
}: YearlyTrendChartProps) {
  // Transform data to TrendDataPoint format
  const trendData: TrendDataPoint[] = data.map(item => ({
    period: item.year,
    amount: item.totalExpense,
    ...(showCategories && item.categories ? item.categories : {})
  }))

  return (
    <div className={className}>
      <TrendChart
        title="Yearly Expense Trend"
        description="Your subscription expenses by year"
        data={trendData}
        period="yearly"
        currency={currency}
        showCategories={showCategories}
      />
    </div>
  )
}