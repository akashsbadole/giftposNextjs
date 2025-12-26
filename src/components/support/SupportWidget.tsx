"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import {
  MessageCircle,
  HelpCircle,
  X,
  Minimize2,
  Maximize2,
  Settings,
  Book,
  Send,
  Zap,
  Clock,
  CheckCircle,
  ExternalLink,
} from "lucide-react"
import { SupportDialog } from "./SupportDialog"
import { HelpCenter } from "./HelpCenter"



interface SupportWidgetProps {
  position?: "bottom-right" | "bottom-left" | "bottom-center"
}

type SupportMode = "support" | "help"

export function SupportWidget({ position = "bottom-right" }: SupportWidgetProps) {
  const { user } = useUser()
  const [currentDialog, setCurrentDialog] = useState<SupportMode | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isVisible, setIsVisible] = useState(true)






  const getPositionClasses = () => {
    switch (position) {
      case "bottom-left":
        return "bottom-4 left-4"
      case "bottom-center":
        return "bottom-4 left-1/2 transform -translate-x-1/2"
      case "bottom-right":
      default:
        return "bottom-4 right-4"
    }
  }

  const openDialog = (dialog: SupportMode) => {
    setCurrentDialog(dialog)
  }

  const closeDialog = () => {
    setCurrentDialog(null)
  }

  const supportOptions = [
    {
      id: "support" as const,
      title: "Contact Support",
      description: "Get help from our support team",
      icon: MessageCircle,
      color: "bg-blue-500 hover:bg-blue-600",
      badge: null,
    },
    {
      id: "help" as const,
      title: "Help Center",
      description: "Browse knowledge base and tutorials",
      icon: HelpCircle,
      color: "bg-green-500 hover:bg-green-600",
      badge: null,
    },

  ]

  if (!isVisible) {
    return null
  }

  return (
    <>
      {/* Support Widget Button */}
      <div className={`fixed z-50 ${getPositionClasses()}`}>
        <Button
          onClick={() => openDialog("support")}
          className="h-14 w-14 rounded-full shadow-lg bg-amber-600"
          variant="default"
          aria-label="Open support menu"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>

      {/* Support Dialog */}
      {currentDialog === "support" && (
        <SupportDialog 
          open={true} 
          onOpenChange={closeDialog} 
        />
      )}

      {/* Help Center Dialog */}
      {currentDialog === "help" && (
        <HelpCenter 
          open={true} 
          onOpenChange={closeDialog} 
        />
      )}


    </>
  )
}

// Hook for using the support widget
export function useSupportWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMode, setCurrentMode] = useState<SupportMode>("support")

  const openSupport = (mode?: SupportMode) => {
    if (mode) {
      setCurrentMode(mode)
    }
    setIsOpen(true)
  }

  const closeSupport = () => {
    setIsOpen(false)
  }

  return {
    isOpen,
    currentMode,
    openSupport,
    closeSupport,
  }
}