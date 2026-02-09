"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/store/settingsStore"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const { setTheme: setStoreTheme } = useSettingsStore()
  const [mounted, setMounted] = useState(false)

  // Only show the toggle after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    // Also update the settings store to keep them in sync
    await setStoreTheme(newTheme as "light" | "dark" | "system");
  }

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled>
      <Moon className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  }
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}