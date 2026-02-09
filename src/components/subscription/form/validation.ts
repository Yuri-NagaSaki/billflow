import { FormErrors, SubscriptionFormData } from "./types"

export const validateForm = (form: SubscriptionFormData, t: (key: string) => string): FormErrors => {
  const errors: FormErrors = {}

  if (!form.name) errors.name = t('validation:required')
  if (!form.plan) errors.plan = t('validation:required')
  if (!form.categoryId || form.categoryId === 0) errors.categoryId = t('validation:required')
  if (!form.paymentMethodId || form.paymentMethodId === 0) errors.paymentMethodId = t('validation:required')
  if (form.amount < 0) errors.amount = t('validation:nonNegativeNumber')

  return errors
}

export const handleFieldChange = (
  name: string,
  value: unknown,
  setForm: React.Dispatch<React.SetStateAction<SubscriptionFormData>>,
  errors: FormErrors,
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>
) => {
  setForm(prev => ({ ...prev, [name]: value }))
  
  // Clear error for this field if any
  if (errors[name]) {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[name]
      return newErrors
    })
  }
}