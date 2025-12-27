import { useEffect, useRef } from 'react'

/**
 * Hook to protect input fields from global event interference
 * Prevents global keydown handlers from interfering with form inputs
 */
export function useInputProtection() {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => {
    // Store the currently focused input element
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true' ||
        target.closest('[data-testid="input-field"]')
      ) {
        inputRef.current = target as HTMLInputElement | HTMLTextAreaElement
      }
    }

    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      if (inputRef.current === target) {
        inputRef.current = null
      }
    }

    // Add event listeners for focus tracking
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  /**
   * Check if a global event should be prevented from interfering with input
   */
  const shouldPreventGlobalHandling = (event: Event): boolean => {
    const target = event.target as HTMLElement
    
    // Check if we're currently focused on an input
    if (inputRef.current && document.activeElement === inputRef.current) {
      return true
    }
    
    // Check if the target is an input element
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.contentEditable === 'true' ||
      target.closest('[data-testid="input-field"]')
    ) {
      return true
    }
    
    return false
  }

  /**
   * Safely handle global keydown events for input fields
   */
  const handleGlobalKeydown = (event: KeyboardEvent): boolean => {
    // Allow normal input behavior if we're in an input field
    if (shouldPreventGlobalHandling(event)) {
      // Don't prevent default, just don't process shortcuts
      return false
    }
    
    // Allow processing for non-input scenarios
    return true
  }

  return {
    shouldPreventGlobalHandling,
    handleGlobalKeydown,
    isInputFocused: () => inputRef.current !== null
  }
}

/**
 * Hook to add comprehensive event debugging for input issues
 */
export function useInputDebugging() {
  const debugRef = useRef(false)

  useEffect(() => {
    // Enable/disable debugging based on localStorage
    const isDebugEnabled = localStorage.getItem('pos_input_debug') === 'true'
    debugRef.current = isDebugEnabled
  }, [])

  const logInputEvent = (eventType: string, event: Event) => {
    if (!debugRef.current) return
    
    const target = event.target as HTMLElement
    console.group(`🔧 Input Debug: ${eventType}`)
    console.log('Target:', target)
    console.log('Tag Name:', target.tagName)
    console.log('Content Editable:', target.contentEditable)
    console.log('Data Test ID:', target.getAttribute('data-testid'))
    console.log('Class Name:', target.className)
    console.log('Event:', event)
    console.groupEnd()
  }

  const enableDebugging = () => {
    localStorage.setItem('pos_input_debug', 'true')
    debugRef.current = true
    console.log('🛠️ Input debugging enabled')
  }

  const disableDebugging = () => {
    localStorage.setItem('pos_input_debug', 'false')
    debugRef.current = false
    console.log('🛠️ Input debugging disabled')
  }

  return {
    logInputEvent,
    enableDebugging,
    disableDebugging,
    isDebugging: () => debugRef.current
  }
}