import { useTranslation } from "react-i18next"
import { useSubscriptionStore } from "@/store/subscriptionStore"
import { useSettingsStore } from "@/store/settingsStore"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrencyAmount } from "@/utils/currency"

interface CategoryBreakdownProps {
  data: Record<string, number>
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const { t } = useTranslation('dashboard');
  // Get categories from the store for labels
  const { categories } = useSubscriptionStore()
  // Get user's preferred currency
  const { currency: userCurrency } = useSettingsStore()
  
  // Calculate total
  const total = Object.values(data).reduce((sum, value) => sum + value, 0)
  
  // Sort categories by amount (descending)
  const sortedCategories = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .filter(([, value]) => value > 0)
    .map(([category]) => category)
  
  // Get appropriate label for a category
  const getCategoryLabel = (categoryValue: string) => {
    const category = categories.find(c => c.value === categoryValue)
    return category?.label || categoryValue
  }
  
  return (
    <Card className="min-h-[200px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg">{t('spendingByCategory')}</CardTitle>
        <CardDescription>{t('annualBreakdownByCategory')}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {sortedCategories.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground">
              {t('noSpendingDataAvailable')}
            </p>
          </div>
        ) : (
          <div className="space-y-4 flex-1">
            {sortedCategories.map((category) => {
              const value = data[category]
              const percentage = total > 0 ? (value / total) * 100 : 0
              
              return (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{getCategoryLabel(category)}</span>
                    <span className="font-medium">
                      {formatCurrencyAmount(value, userCurrency)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-secondary overflow-hidden rounded-full">
                    <div 
                      className="h-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}