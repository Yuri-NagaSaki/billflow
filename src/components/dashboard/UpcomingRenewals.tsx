import { useTranslation } from "react-i18next"
import { Calendar, CalendarIcon } from "lucide-react"
import { Subscription } from "@/store/subscriptionStore"
import { formatDate, daysUntil } from "@/lib/subscription-utils"
import { formatWithUserCurrency } from "@/utils/currency"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { cn } from "@/lib/utils"

interface UpcomingRenewalsProps {
  subscriptions: Subscription[]
  className?: string
}

export function UpcomingRenewals({ subscriptions, className }: UpcomingRenewalsProps) {
  const { t } = useTranslation('dashboard');

  const getBadgeVariant = (daysLeft: number) => {
    if (daysLeft <= 3) return "destructive"
    if (daysLeft <= 7) return "warning"
    return "secondary"
  }

  const getTimeLabel = (daysLeft: number) => {
    if (daysLeft === 0) return t('today')
    if (daysLeft === 1) return t('tomorrow')
    return `${daysLeft} ${t('days')}`
  }

  return (
    <Card className={cn("min-h-[200px] flex flex-col", className)}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg">{t('upcomingRenewals')}</CardTitle>
        <CardDescription>
          {t('subscriptionsRenewingInNext7Days')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {subscriptions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Calendar className="h-10 w-10 text-muted-foreground opacity-50 mb-2" />
            <p className="text-muted-foreground">{t('noUpcomingRenewalsNext7Days')}</p>
          </div>
        ) : (
          <div className="space-y-4 flex-1">
            {subscriptions.map((subscription) => {
              const daysRemaining = daysUntil(subscription.nextBillingDate)
              return (
                <div
                  key={subscription.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col">
                    <div className="font-medium">{subscription.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {subscription.plan}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-medium">
                        {formatWithUserCurrency(subscription.amount, subscription.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {formatDate(subscription.nextBillingDate)}
                      </div>
                    </div>
                    <Badge variant={getBadgeVariant(daysRemaining)}>
                      {getTimeLabel(daysRemaining)}
                    </Badge>
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