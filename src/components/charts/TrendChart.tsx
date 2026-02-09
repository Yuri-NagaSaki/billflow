import { useState, useMemo } from "react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts"
import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrencyAmount } from "@/utils/currency"

interface TooltipPayload {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}
import { CHART_COLORS } from "@/config/constants"
import { TrendDataPoint } from "@/types"

interface TrendChartProps {
  title: string
  description: string
  data: TrendDataPoint[]
  period: 'monthly' | 'yearly'
  currency?: string
  showCategories?: boolean
}

export function TrendChart({
  title,
  description,
  data,
  currency = 'USD',
  showCategories = false
}: TrendChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

  // Calculate trend
  const { trendPercentage, isPositive } = useMemo(() => {
    if (data.length < 2) return { trendPercentage: 0, isPositive: true }
    
    const lastValue = data[data.length - 1].amount
    const previousValue = data[data.length - 2].amount
    
    if (previousValue === 0) return { trendPercentage: 0, isPositive: true }
    
    const percentage = ((lastValue - previousValue) / previousValue) * 100
    return {
      trendPercentage: Math.abs(percentage),
      isPositive: percentage < 0
    }
  }, [data])

  // Get category keys for chart
  const categoryKeys = useMemo(() => {
    if (!showCategories || data.length === 0) return []
    
    const allCategories = new Set<string>()
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'period' && key !== 'amount' && key !== 'name' && key !== 'value') {
          allCategories.add(key)
        }
      })
    })
    
    return Array.from(allCategories)
  }, [data, showCategories])

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium">{label}</p>
        {payload.map((entry: TooltipPayload, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrencyAmount(entry.value, currency)}
          </p>
        ))}
      </div>
    )
  }

  const renderChart = () => {
    const chartHeight = 300
    const chartData = data.map(item => ({
      ...item,
      name: item.period,
      value: item.amount
    }))

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ className: "opacity-30" }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ className: "opacity-30" }}
              tickFormatter={(value) => formatCurrencyAmount(value, currency, true)}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {showCategories && categoryKeys.length > 0 ? (
              categoryKeys.map((category, index) => (
                <Line
                  key={category}
                  type="monotone"
                  dataKey={category}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={category}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Total"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )
    } else {
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ className: "opacity-30" }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ className: "opacity-30" }}
              tickFormatter={(value) => formatCurrencyAmount(value, currency, true)}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {showCategories && categoryKeys.length > 0 ? (
              categoryKeys.map((category, index) => (
                <Bar
                  key={category}
                  dataKey={category}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  name={category}
                  stackId="stack"
                />
              ))
            ) : (
              <Bar dataKey="value" name="Total">
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CHART_COLORS[index % CHART_COLORS.length]} 
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      )
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm">
              {isPositive ? (
                <TrendingDown className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingUp className="h-4 w-4 text-red-600" />
              )}
              <span className={isPositive ? "text-green-600" : "text-red-600"}>
                {trendPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant={chartType === 'line' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('line')}
              >
                Line
              </Button>
              <Button
                variant={chartType === 'bar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('bar')}
              >
                Bar
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          renderChart()
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available for the selected period
          </div>
        )}
      </CardContent>
    </Card>
  )
}