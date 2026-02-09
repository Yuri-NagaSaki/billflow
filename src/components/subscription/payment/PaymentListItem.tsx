import { Calendar, Edit, Trash2, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PaymentRecord } from "@/utils/dataTransform"
import { formatWithUserCurrency } from "@/utils/currency"
import { formatDateDisplay } from "@/utils/date"

interface PaymentListItemProps {
  payment: PaymentRecord
  onEdit: (payment: PaymentRecord) => void
  onDelete: (paymentId: number) => void
}

export function PaymentListItem({
  payment,
  onEdit,
  onDelete
}: PaymentListItemProps) {
  const { t } = useTranslation(['common', 'subscription'])
  // Get status badge color
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'succeeded':
        return 'default'
      case 'failed':
        return 'destructive'
      case 'refunded':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <Card className="group hover:bg-muted/50 transition-all duration-200 border hover:border-muted-foreground/20">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="font-semibold text-base">
                {formatWithUserCurrency(payment.amountPaid, payment.currency)}
              </span>
              <Badge
                variant={getStatusBadgeVariant(payment.status)}
                className="text-xs h-5 px-2 w-fit font-medium"
              >
                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{t('common:paid')}: {formatDateDisplay(payment.paymentDate)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{t('common:billingPeriod')}:</span>
                <br className="sm:hidden" />
                <span className="sm:ml-2">
                  {formatDateDisplay(payment.billingPeriod.start)} - {formatDateDisplay(payment.billingPeriod.end)}
                </span>
              </div>
            </div>
          </div>

          {/* Menu button positioned at top-right */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 opacity-70 group-hover:opacity-100 transition-opacity touch-manipulation"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => onEdit(payment)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Edit className="h-4 w-4" />
                  {t('common:editPayment')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(payment.id)}
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common:deletePayment')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}