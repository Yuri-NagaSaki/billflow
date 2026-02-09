import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

import { formatCurrencyAmount } from "@/utils/currency"
import { transformPaymentsFromApi, type PaymentRecord, type PaymentRecordApi } from '@/utils/dataTransform'
import { apiClient } from '@/utils/api-client'
import { formatDateDisplay } from '@/utils/date'
import {
  Search,
  Calendar,
  DollarSign,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react"
import { ExpenseInfoData } from "./ExpenseInfoCards"

// The API client already extracts the data field, so we get the array directly
type PaymentHistoryApiResponse = PaymentRecordApi[]

interface ExpenseDetailDialogProps {
  isOpen: boolean
  onClose: () => void
  periodData: ExpenseInfoData
}

export function ExpenseDetailDialog({ isOpen, onClose, periodData }: ExpenseDetailDialogProps) {
  const { t } = useTranslation(['reports', 'common'])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)


  const pageSize = 10

  const fetchPaymentData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      let allPaymentDetails: PaymentRecord[] = []

      if (periodData.periodType === 'monthly') {
        // 月度数据：直接从 payment-history API 获取数据
        const startDate = new Date(periodData.startDate)
        const endDate = new Date(periodData.endDate)

        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        const rawData = await apiClient.get<PaymentHistoryApiResponse>(`/payment-history?start_date=${startDateStr}&end_date=${endDateStr}&status=succeeded`)
        allPaymentDetails = transformPaymentsFromApi(rawData)
      } else {
        // 季度或年度数据：直接从 payment-history API 获取整个时间范围的数据
        const startDate = new Date(periodData.startDate)
        const endDate = new Date(periodData.endDate)

        const startDateStr = startDate.toISOString().split('T')[0]
        const endDateStr = endDate.toISOString().split('T')[0]

        const rawData = await apiClient.get<PaymentHistoryApiResponse>(`/payment-history?start_date=${startDateStr}&end_date=${endDateStr}&status=succeeded`)
        allPaymentDetails = transformPaymentsFromApi(rawData)
      }

      setPayments(allPaymentDetails)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment data')
    } finally {
      setIsLoading(false)
    }
  }, [periodData])

  // Fetch payment data when dialog opens
  useEffect(() => {
    if (isOpen && periodData) {
      fetchPaymentData()
    }
  }, [isOpen, periodData, fetchPaymentData])

  // Reset current page when search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Filter payments based on search term
  const filteredPayments = payments.filter(payment =>
    (payment.subscriptionName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (payment.subscriptionPlan?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  // Paginate filtered payments
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex)

  // Update pagination info based on filtered results
  const filteredTotalPages = Math.ceil(filteredPayments.length / pageSize)


  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'refunded':
        return 'bg-yellow-100 text-yellow-800'
      case 'unknown':
      case null:
      case undefined:
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {periodData.period} - {t('reports:chart.paymentDetails')}
          </DialogTitle>
          <DialogDescription>
            {t('reports:chart.viewPaymentRecords')}
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('reports:chart.total')}</p>
                  <p className="font-semibold">{formatCurrencyAmount(periodData.totalSpent, periodData.currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('reports:chart.payments')}</p>
                  <p className="font-semibold">
                    {payments.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('reports:chart.dailyAvg')}</p>
                  <p className="font-semibold">{formatCurrencyAmount(periodData.dailyAverage, periodData.currency)}</p>
                </div>
              </div>
            </CardContent>
          </Card>


        </div>

        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('reports:chart.searchSubscriptions')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Payment List */}
        <div className="h-[400px] w-full border border-gray-200 rounded-md overflow-y-auto">
          <div className="space-y-2 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">{t('common:loadingPayments')}</span>
              </div>
            ) : error ? (
              <div className="text-center text-destructive p-4">
                <p>{t('reports:chart.errorLoadingPayments')}: {error}</p>
                <Button variant="outline" onClick={fetchPaymentData} className="mt-2">
                  {t('common:retry')}
                </Button>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center text-muted-foreground p-4">
                {t('reports:chart.noPaymentsFoundPeriod')}
              </div>
            ) : (
              paginatedPayments.map((payment, index) => (
                <Card
                  key={payment.id}
                  className="hover:bg-muted/50 transition-all duration-200 hover:shadow-md animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{payment.subscriptionName || t('reports:chart.unknownSubscription')}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {payment.subscriptionPlan || t('reports:chart.unknownPlan')}
                          </Badge>
                          <Badge className={`text-xs ${getStatusColor(payment.status || 'unknown')}`}>
                            {payment.status || t('reports:chart.unknown')}
                          </Badge>
                          {payment.billingCycle && payment.billingCycle !== 'monthly' && (
                            <Badge variant="outline" className="text-xs">
                              {payment.billingCycle}
                            </Badge>
                          )}
                          {(payment.billingCycle === 'yearly' || payment.billingCycle === 'quarterly') && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              {t('reports:chart.allocated')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{t('common:paid')}: {formatDateDisplay(payment.paymentDate)}</span>
                          <span>
                            {t('common:billing')}: {formatDateDisplay(payment.billingPeriod?.start)} - {formatDateDisplay(payment.billingPeriod?.end)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrencyAmount(payment.amountPaid, payment.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">{payment.currency}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {filteredTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {t('reports:chart.showingPayments', {
                start: ((currentPage - 1) * pageSize) + 1,
                end: Math.min(currentPage * pageSize, filteredPayments.length),
                total: filteredPayments.length
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('common:previous')}
              </Button>
              <span className="text-sm">
                {t('reports:chart.pageOf', {
                  current: currentPage,
                  total: filteredTotalPages
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(filteredTotalPages, prev + 1))}
                disabled={currentPage === filteredTotalPages}
              >
                {t('common:next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
