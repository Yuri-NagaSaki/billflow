import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { CurrencySelector } from "@/components/subscription/CurrencySelector"
import { FormField } from "./FormField"
import { useState, useEffect } from "react"

interface AmountInputProps {
  amount: number
  currency: string
  onAmountChange: (value: number) => void
  onCurrencyChange: (value: string) => void
  error?: string
}

export function AmountInput({ amount, currency, onAmountChange, onCurrencyChange, error }: AmountInputProps) {
  const { t } = useTranslation('common')
  const [inputValue, setInputValue] = useState<string>("")

  // Sync input value with amount prop
  useEffect(() => {
    setInputValue(amount.toString())
  }, [amount])

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // Only update the parent if the value is a valid number or empty
    if (value === "" || value === "-") {
      onAmountChange(0)
    } else {
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        onAmountChange(numValue)
      }
    }
  }

  return (
    <FormField label={t('amount')} error={error} required>
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-3">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={inputValue}
            onChange={handleNumberChange}
            className={error ? "border-destructive" : ""}
          />
        </div>
        <div className="col-span-2">
          <CurrencySelector
            value={currency}
            onValueChange={onCurrencyChange}
          />
        </div>
      </div>
    </FormField>
  )
}