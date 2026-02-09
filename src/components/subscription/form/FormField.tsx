

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function FormField({ label, error, required, className = "", children }: FormFieldProps) {
  return (
    <div className={`grid grid-cols-4 items-center gap-4 ${className}`}>
      <label className="text-right">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <div className="col-span-3">
        {children}
        {error && (
          <p className="text-destructive text-xs mt-1">{error}</p>
        )}
      </div>
    </div>
  )
}