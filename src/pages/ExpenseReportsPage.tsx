import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from "@/store/settingsStore"
import {
  MonthlyExpense,
  YearlyExpense,
  CategoryExpense,
  calculateYearlyExpensesFromMonthly,
  transformMonthlyCategorySummaries,
  calculateCategoryExpensesFromNewApi,
  transformMonthlyCategorySummariesToGroupedData,
  transformMonthlyCategorySummariesToYearlyGroupedData,
} from "@/lib/expense-analytics-api"
import {
  convertMonthlyExpensesToInfo,
  calculateQuarterlyExpenses,
  calculateYearlyExpenses,
  filterRecentExpenses
} from "@/lib/expense-info-analytics"
import { ExpenseInfoData } from "@/components/charts/ExpenseInfoCards"
import { ExpenseTrendChart } from "@/components/charts/ExpenseTrendChart"
import { YearlyTrendChart } from "@/components/charts/YearlyTrendChart"
import { CategoryPieChart } from "@/components/charts/CategoryPieChart"
import { ExpenseInfoCards } from "@/components/charts/ExpenseInfoCards"
import { apiClient } from '@/utils/api-client'
import { getMonthlyCategorySummaries } from '@/services/monthlyCategorySummaryApi'
import type { PaymentRecordApi } from '@/utils/dataTransform'


import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


export function ExpenseReportsPage() {
  const { t } = useTranslation(['reports', 'common'])
  const { currency: userCurrency, fetchSettings } = useSettingsStore()

  // Filter states
  const [selectedDateRange] = useState('Last 12 Months')
  const [selectedYearlyDateRange] = useState(() => {
    const currentYear = new Date().getFullYear()
    return `${currentYear - 2} - ${currentYear}`
  })

  // Fetch settings on mount (freshness check inside)
  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Get date range presets - create stable date range
  const currentDateRange = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const presets = {
      'Last 3 Months': {
        startDate: new Date(currentYear, currentMonth - 2, 1),
        endDate: now
      },
      'Last 6 Months': {
        startDate: new Date(currentYear, currentMonth - 5, 1),
        endDate: now
      },
      'Last 12 Months': {
        startDate: new Date(currentYear, currentMonth - 11, 1),
        endDate: now
      },
      'This Year': {
        startDate: new Date(currentYear, 0, 1),
        endDate: now
      },
      'Last Year': {
        startDate: new Date(currentYear - 1, 0, 1),
        endDate: new Date(currentYear - 1, 11, 31)
      }
    }

    return presets[selectedDateRange as keyof typeof presets] || presets['Last 12 Months']
  }, [selectedDateRange])

  // Get yearly date range presets (fixed recent 3 years)
  const yearlyDateRangePresets = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11
    return [
      {
        label: `${currentYear - 2} - ${currentYear}`,
        startDate: new Date(currentYear - 2, 0, 1),
        endDate: new Date(currentYear, currentMonth, new Date(currentYear, currentMonth + 1, 0).getDate())
      }
    ]
  }, [])

  const currentYearlyDateRange = useMemo(() => {
    return yearlyDateRangePresets.find(preset => preset.label === selectedYearlyDateRange)
      || yearlyDateRangePresets[0]
  }, [selectedYearlyDateRange, yearlyDateRangePresets])

  // State for API data
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([])
  const [yearlyExpenses, setYearlyExpenses] = useState<YearlyExpense[]>([])
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [yearlyCategoryExpenses, setYearlyCategoryExpenses] = useState<CategoryExpense[]>([])
  const [monthlyCategoryExpenses, setMonthlyCategoryExpenses] = useState<{ month: string; monthKey: string; year: number; categories: { [categoryName: string]: number }; total: number }[]>([])
  const [yearlyGroupedCategoryExpenses, setYearlyGroupedCategoryExpenses] = useState<{ year: number; categories: { [categoryName: string]: number }; total: number }[]>([])

  // State for expense info data
  const [expenseInfoData, setExpenseInfoData] = useState<{
    monthly: ExpenseInfoData[]
    quarterly: ExpenseInfoData[]
    yearly: ExpenseInfoData[]
  }>({
    monthly: [],
    quarterly: [],
    yearly: []
  })

  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false)
  const [isLoadingYearlyExpenses, setIsLoadingYearlyExpenses] = useState(false)
  const [isLoadingCategoryExpenses, setIsLoadingCategoryExpenses] = useState(false)
  const [isLoadingYearlyCategoryExpenses, setIsLoadingYearlyCategoryExpenses] = useState(false)

  const [isLoadingExpenseInfo, setIsLoadingExpenseInfo] = useState(false)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [yearlyExpenseError, setYearlyExpenseError] = useState<string | null>(null)
  const [categoryExpenseError, setCategoryExpenseError] = useState<string | null>(null)
  const [yearlyCategoryExpenseError, setYearlyCategoryExpenseError] = useState<string | null>(null)

  const [expenseInfoError, setExpenseInfoError] = useState<string | null>(null)


  // Effect 1 - Expense info data (unique fillAccurateCounts logic)
  useEffect(() => {
    const loadExpenseInfoData = async () => {
      setIsLoadingExpenseInfo(true)
      setExpenseInfoError(null)

      try {
        // Get recent 12 months of data for expense info
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(startDate.getMonth() - 12)

        const startYear = startDate.getFullYear()
        const startMonth = startDate.getMonth() + 1
        const endYear = endDate.getFullYear()
        const endMonth = endDate.getMonth() + 1

        const response = await getMonthlyCategorySummaries(startYear, startMonth, endYear, endMonth)
        const allMonthlyData = transformMonthlyCategorySummaries(response, userCurrency)

        // Process API data
        if (allMonthlyData && allMonthlyData.length > 0) {
          const { monthlyExpenses: recentMonthly, quarterlyExpenses: recentQuarterly, yearlyExpenses: recentYearly } = filterRecentExpenses(allMonthlyData)

          // Convert to expense info format
          const monthlyInfo = convertMonthlyExpensesToInfo(recentMonthly, userCurrency)
          const quarterlyInfo = calculateQuarterlyExpenses(recentQuarterly, userCurrency)
          const yearlyInfo = calculateYearlyExpenses(recentYearly, userCurrency)

          // Ensure paymentCount matches real payment-history records
          const fillAccurateCounts = async (list: ExpenseInfoData[]): Promise<ExpenseInfoData[]> => {
            const updated = await Promise.all(
              list.map(async (item) => {
                try {
                  const records = await apiClient.get<PaymentRecordApi[]>(
                    `/payment-history?start_date=${item.startDate}&end_date=${item.endDate}&status=succeeded`
                  )
                  return { ...item, paymentCount: records.length }
                } catch {
                  return item
                }
              })
            )
            return updated
          }

          const [monthlyFixed, quarterlyFixed, yearlyFixed] = await Promise.all([
            fillAccurateCounts(monthlyInfo),
            fillAccurateCounts(quarterlyInfo),
            fillAccurateCounts(yearlyInfo)
          ])

          setExpenseInfoData({
            monthly: monthlyFixed,
            quarterly: quarterlyFixed,
            yearly: yearlyFixed
          })
        } else {
          setExpenseInfoData({ monthly: [], quarterly: [], yearly: [] })
        }

      } catch (error) {
        console.error('Failed to load expense info data:', error)
        setExpenseInfoError(error instanceof Error ? error.message : 'Failed to load expense info data')
        setExpenseInfoData({ monthly: [], quarterly: [], yearly: [] })
      } finally {
        setIsLoadingExpenseInfo(false)
      }
    }

    loadExpenseInfoData()
  }, [userCurrency])

  // Effect 2 - Monthly date range: single API call, derive monthly expenses + category expenses + grouped category data
  useEffect(() => {
    const loadMonthlyRangeData = async () => {
      setIsLoadingExpenses(true)
      setIsLoadingCategoryExpenses(true)
      setExpenseError(null)
      setCategoryExpenseError(null)

      try {
        const startYear = currentDateRange.startDate.getFullYear()
        const startMonth = currentDateRange.startDate.getMonth() + 1
        const endYear = currentDateRange.endDate.getFullYear()
        const endMonth = currentDateRange.endDate.getMonth() + 1

        // Single API call for the monthly date range
        const response = await getMonthlyCategorySummaries(startYear, startMonth, endYear, endMonth)

        // Derive all three datasets from the same response
        const monthlyData = transformMonthlyCategorySummaries(response, userCurrency)
        const categoryData = calculateCategoryExpensesFromNewApi(response, userCurrency)
        const monthlyCategoryData = transformMonthlyCategorySummariesToGroupedData(response, userCurrency)

        setMonthlyExpenses(monthlyData)
        setCategoryExpenses(categoryData)
        setMonthlyCategoryExpenses(monthlyCategoryData)

      } catch (error) {
        console.error('Failed to load monthly range data:', error)
        const msg = error instanceof Error ? error.message : 'Failed to load expense data'
        setExpenseError(msg)
        setCategoryExpenseError(msg)
      } finally {
        setIsLoadingExpenses(false)
        setIsLoadingCategoryExpenses(false)
      }
    }

    loadMonthlyRangeData()
  }, [currentDateRange, userCurrency])

  // Effect 3 - Yearly date range: single API call, derive yearly expenses + yearly category expenses + yearly grouped data
  useEffect(() => {
    const loadYearlyRangeData = async () => {
      setIsLoadingYearlyExpenses(true)
      setIsLoadingYearlyCategoryExpenses(true)
      setYearlyExpenseError(null)
      setYearlyCategoryExpenseError(null)

      try {
        const startYear = currentYearlyDateRange.startDate.getFullYear()
        const startMonth = currentYearlyDateRange.startDate.getMonth() + 1
        const endYear = currentYearlyDateRange.endDate.getFullYear()
        const endMonth = currentYearlyDateRange.endDate.getMonth() + 1

        // Single API call for the yearly date range
        const response = await getMonthlyCategorySummaries(startYear, startMonth, endYear, endMonth)

        // Derive all three datasets from the same response
        const monthlyForYearly = transformMonthlyCategorySummaries(response, userCurrency)
        const yearlyData = calculateYearlyExpensesFromMonthly(monthlyForYearly)
        const yearlyCategoryData = calculateCategoryExpensesFromNewApi(response, userCurrency)
        const yearlyGroupedData = transformMonthlyCategorySummariesToYearlyGroupedData(response, userCurrency)

        setYearlyExpenses(yearlyData)
        setYearlyCategoryExpenses(yearlyCategoryData)
        setYearlyGroupedCategoryExpenses(yearlyGroupedData)

      } catch (error) {
        console.error('Failed to load yearly range data:', error)
        const msg = error instanceof Error ? error.message : 'Failed to load yearly data'
        setYearlyExpenseError(msg)
        setYearlyCategoryExpenseError(msg)
      } finally {
        setIsLoadingYearlyExpenses(false)
        setIsLoadingYearlyCategoryExpenses(false)
      }
    }

    loadYearlyRangeData()
  }, [currentYearlyDateRange, userCurrency])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
      </div>

      {/* Expense Info Cards */}
      <div className="space-y-6">
        <div>
          {isLoadingExpenseInfo ? (
            <div>
              <p className="text-sm text-muted-foreground mb-4">{t('loadingExpenseOverview')}</p>
              <ExpenseInfoCards
                monthlyData={[]}
                quarterlyData={[]}
                yearlyData={[]}
                currency={userCurrency}
                isLoading={true}
              />
            </div>
          ) : expenseInfoError ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <p className="text-sm text-destructive mb-2">{t('failedToLoadExpenseOverview')}</p>
                  <p className="text-xs text-muted-foreground">{expenseInfoError}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>
              <ExpenseInfoCards
                monthlyData={expenseInfoData.monthly}
                quarterlyData={expenseInfoData.quarterly}
                yearlyData={expenseInfoData.yearly}
                currency={userCurrency}
              />
            </div>
          )}
        </div>
      </div>



      {/* Loading and Error States */}
      {isLoadingExpenses && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">{t('loadingExpenseData')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {expenseError && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <p className="text-sm text-destructive mb-2">{t('failedToLoadExpenseData')}</p>
              <p className="text-xs text-muted-foreground">{expenseError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {!isLoadingExpenses && !expenseError && (
        <div className="space-y-4">
          <Tabs defaultValue="monthly" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">{t('monthly')}</TabsTrigger>
              <TabsTrigger value="yearly">{t('yearly')}</TabsTrigger>
            </TabsList>

            <TabsContent value="monthly" className="space-y-4">
              <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                <ExpenseTrendChart
                  data={monthlyExpenses}
                  categoryData={monthlyCategoryExpenses}
                  currency={userCurrency}
                />
                {isLoadingCategoryExpenses ? (
                  <Card>
                    <CardContent className="flex items-center justify-center h-[400px]">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">{t('loadingCategoryData')}</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : categoryExpenseError ? (
                  <Card>
                    <CardContent className="flex items-center justify-center h-[400px]">
                      <div className="text-center text-destructive">
                        <p className="font-medium">{t('failedToLoadCategoryData')}</p>
                        <p className="text-sm text-muted-foreground mt-1">{categoryExpenseError}</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <CategoryPieChart
                    data={categoryExpenses}
                    currency={userCurrency}
                    descriptionKey="chart.breakdownByCategory"
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="yearly" className="space-y-4">
              {isLoadingYearlyExpenses ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">{t('loadingYearlyData')}</p>
                  </div>
                </div>
              ) : yearlyExpenseError ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <p className="text-sm text-destructive mb-2">{t('failedToLoadYearlyData')}</p>
                    <p className="text-xs text-muted-foreground">{yearlyExpenseError}</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                  <YearlyTrendChart
                    data={yearlyExpenses}
                    categoryData={yearlyGroupedCategoryExpenses}
                    currency={userCurrency}
                  />
                  {isLoadingYearlyCategoryExpenses ? (
                    <Card>
                      <CardContent className="flex items-center justify-center h-[400px]">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                          <p className="text-sm text-muted-foreground">{t('loadingYearlyCategoryData')}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : yearlyCategoryExpenseError ? (
                    <Card>
                      <CardContent className="flex items-center justify-center h-[400px]">
                        <div className="text-center text-destructive">
                          <p className="font-medium">{t('failedToLoadYearlyCategoryData')}</p>
                          <p className="text-sm text-muted-foreground mt-1">{yearlyCategoryExpenseError}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <CategoryPieChart
                      data={yearlyCategoryExpenses}
                      currency={userCurrency}
                      descriptionKey="chart.breakdownByCategoryYearly"
                    />
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
