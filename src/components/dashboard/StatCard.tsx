import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
}

export function StatCard({ title, value, description, icon: Icon, iconColor, trend }: StatCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 flex-shrink-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className={`h-4 w-4 ${iconColor || 'text-muted-foreground'}`} />}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="text-2xl font-bold mb-2">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mb-2">{description}</p>
        )}
        {trend && (
          <div className="mt-auto flex items-center text-xs">
            <span
              className={
                trend.positive !== false
                  ? "text-success"
                  : "text-destructive"
              }
            >
              {trend.positive !== false ? "+" : "-"}
              {trend.value}%
            </span>
            <span className="ml-1 text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}