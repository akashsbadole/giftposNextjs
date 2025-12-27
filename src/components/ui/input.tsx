import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ 
  className, 
  type, 
  onChange, 
  onInput,
  onFocus,
  onBlur,
  ...props 
}: React.ComponentProps<"input">) {
  // Enhanced event handling to prevent conflicts
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Ensure the event propagates properly
    e.stopPropagation()
    
    // Call the original onChange if provided
    if (onChange) {
      onChange(e)
    }
  }

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    // Handle React 19 compatibility
    e.stopPropagation()
    
    if (onInput) {
      onInput(e as any)
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Ensure focus events work properly
    e.stopPropagation()
    
    if (onFocus) {
      onFocus(e)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.stopPropagation()
    
    if (onBlur) {
      onBlur(e)
    }
  }

  return (
    <input
      type={type}
      data-slot="input"
      // Enhanced accessibility and interaction
      autoComplete="off"
      spellCheck={false}
      data-testid="input-field"
      className={cn(
        "file:text-foreground placeholder:text-gray-400 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
        "hover:border-ring/50 hover:ring-ring/25 hover:ring-[1px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        // Ensure input is always interactive
        "pointer-events-auto touch-manipulation",
        className
      )}
      onChange={handleChange}
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  )
}

export { Input }
