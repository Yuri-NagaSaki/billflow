import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartConfig } from "@/components/ui/chart"
import { formatCurrencyAmount } from "@/utils/currency"
import { MonthlyExpense } from "@/lib/expense-analytics-api"

interface ExpenseBarChartProps {
  data: MonthlyExpense[]
  currency: string
  title?: string
  description?: string
  className?: string
}

const chartConfig = {
  amount: {
    label: "Amount",
    color: "hsl(var(--chart-1))",
  },
  subscriptionCount: {
    label: "Subscriptions",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ExpenseBarChart({ 
  data, 
  currency, 
  title = "Monthly Expenses",
  description = "Expense breakdown by month",
  className 
}: ExpenseBarChartProps) {
  // Calculate average
  const average = data.length > 0 
    ? data.reduce((sum, item) => sum + item.amount, 0) / data.length 
    : 0
  
  // Find highest and lowest months
  const highest = data.length > 0 
    ? data.reduce((max, item) => item.amount > max.amount ? item : max)
    : null
    
  const lowest = data.length > 0 
    ? data.reduce((min, item) => item.amount < min.amount ? item : min)
    : null

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {data.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Average: </span>
              {formatCurrencyAmount(average, currency)}
            </div>
            {highest && (
              <div>
                <span className="font-medium">Highest: </span>
                {formatCurrencyAmount(highest.amount, currency)} ({highest.month})
              </div>
            )}
            {lowest && (
              <div>
                <span className="font-medium">Lowest: </span>
                {formatCurrencyAmount(lowest.amount, currency)} ({lowest.month})
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No expense data available
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatCurrencyAmount(value, currency)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as MonthlyExpense
                      return (
                        <div className="rounded-lg border bg-background p-3 shadow-md">
                          <div className="grid gap-2">
                            <div className="font-medium">{label}</div>
                            <div className="grid gap-1 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-medium">
                                  {formatCurrencyAmount(data.amount, currency)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Subscriptions:</span>
                                <span className="font-medium">{data.subscriptionCount}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">vs Average:</span>
                                <span className={`font-medium ${data.amount > average ? 'text-red-500' : 'text-green-500'}`}>
                                  {data.amount > average ? '+' : ''}
                                  {formatCurrencyAmount(data.amount - average, currency)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="var(--color-amount)"
                  radius={[4, 4, 0, 0]}
                />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
