import { useTranslation } from "react-i18next";
import { HandCoins } from "lucide-react";
import { Subscription } from "@/store/subscriptionStore";
import { formatDate } from "@/lib/subscription-utils";
import { formatWithUserCurrency } from "@/utils/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { cn } from "@/lib/utils";

interface RecentlyPaidProps {
  subscriptions: Subscription[];
  className?: string;
}

export function RecentlyPaid({ subscriptions, className }: RecentlyPaidProps) {
  const { t } = useTranslation('dashboard');

  return (
    <Card className={cn("min-h-[200px] flex flex-col", className)}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg">{t('recentlyPaid')}</CardTitle>
        <CardDescription>
          {t('subscriptionsPaidInLast7Days')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {subscriptions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <HandCoins className="h-10 w-10 text-muted-foreground opacity-50 mb-2" />
            <p className="text-muted-foreground">{t('noSubscriptionsPaidInLast7Days')}</p>
          </div>
        ) : (
          <div className="space-y-4 flex-1">
            {subscriptions.map((subscription) => (
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
                      {t('paidOn')}: {formatDate(subscription.lastBillingDate!)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 