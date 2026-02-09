import { useState } from "react"

interface UseConfirmationOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
}

export function useConfirmation({
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
}: UseConfirmationOptions) {
  const [isOpen, setIsOpen] = useState(false)

  const openDialog = () => setIsOpen(true)
  const closeDialog = () => setIsOpen(false)

  const handleConfirm = async () => {
    await onConfirm()
    closeDialog()
  }

  return {
    isOpen,
    openDialog,
    closeDialog,
    dialogProps: {
      open: isOpen,
      onOpenChange: setIsOpen,
      title,
      description,
      confirmText,
      cancelText,
      onConfirm: handleConfirm,
      isDestructive: true,
    },
  }
}