import { Check } from "lucide-react"

interface CompleteStepProps {
  subscriptionCount: number
}

export function CompleteStep({ subscriptionCount }: CompleteStepProps) {
  return (
    <div className="py-12 text-center space-y-6">
      <div className="mx-auto rounded-full bg-green-100 p-3 w-16 h-16 flex items-center justify-center">
        <Check className="h-8 w-8 text-green-600" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Import Completed</h3>
        <p className="text-muted-foreground">
          Successfully imported {subscriptionCount} subscriptions
        </p>
      </div>
    </div>
  )
}