import { Subscription } from "@/store/subscriptionStore"

// Import data type - excludes auto-calculated fields
export type SubscriptionImportData = Omit<Subscription, "id" | "lastBillingDate">

export enum ImportStep {
  Upload,
  Validate,
  Review,
  Complete
}