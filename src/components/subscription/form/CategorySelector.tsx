import { useState } from "react"
import { Check, ChevronsUpDown, Settings } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { FormField } from "./FormField"

interface CategorySelectorProps {
  value: number
  onChange: (value: number) => void
  categories: Array<{ id: number; value: string; label: string }>
  error?: string
}

export function CategorySelector({ value, onChange, categories, error }: CategorySelectorProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)

  const handleSelect = (selectedValue: string) => {
    const category = categories.find(cat => cat.value === selectedValue)
    if (category) {
      onChange(category.id)
    }
    setOpen(false)
  }

  return (
    <FormField label={t('common:category')} error={error} required>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              error ? "border-destructive" : ""
            )}
          >
            {value
              ? categories.find(category => category.id === value)?.label || t('common:unknownCategory')
              : t('common:selectCategory')
            }
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder={t('common:searchCategory')} />
            <CommandEmpty>{t('common:noCategoryFound')}</CommandEmpty>
            <CommandList className="max-h-[300px] overflow-auto">
              <CommandGroup>
                <div className="flex items-center justify-between px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <span>{t('common:categories')}</span>
                  <Settings
                    className="h-4 w-4 cursor-pointer hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpen(false)
                      navigate('/settings?tab=options')
                    }}
                  />
                </div>
                {categories.map((category) => (
                  <CommandItem
                    key={category.value}
                    value={category.value}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === category.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {category.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormField>
  )
}