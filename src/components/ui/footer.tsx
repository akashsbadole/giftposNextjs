"use client"

import React, { Suspense } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Mail, 
  Phone, 
  Settings, 
  FileText, 
  HelpCircle, 
  Circle,
  Clock,
  Shield,
  Database,
  Wifi,
  WifiOff,
  MessageCircle,
  AlertTriangle,
  Bug
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSupportWidget } from "@/components/support/SupportWidget"

// Support contact information
const SUPPORT_CONTACTS = {
  email: "support@retailpos.com",
  phone: "+1 (555) 123-4567",
}

// Quick navigation links
const QUICK_LINKS = [
  { label: "Help", href: "/help", icon: HelpCircle, action: "help" },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Reports", href: "/reports", icon: FileText },
]

// Support actions
const SUPPORT_ACTIONS = [
  { label: "Contact Support", action: "support", icon: MessageCircle },
  { label: "Report Error", action: "error", icon: AlertTriangle },
  { label: "Help Center", action: "help", icon: HelpCircle },
]

// System status indicators
const SYSTEM_COMPONENTS = [
  { name: "Database", status: "online", icon: Database },
  { name: "Payment Gateway", status: "online", icon: Shield },
  { name: "Network", status: "online", icon: Wifi },
]

// Client-only timestamp component to avoid hydration mismatch
const ClientOnlyTimestamp = React.lazy(() => {
  return new Promise<{ default: React.ComponentType }>((resolve) => {
    setTimeout(() => {
      resolve({
        default: function TimestampDisplay() {
          const [currentTime, setCurrentTime] = React.useState<Date>(new Date())
          
          React.useEffect(() => {
            setCurrentTime(new Date())
            
            const timer = setInterval(() => {
              setCurrentTime(new Date())
            }, 60000)

            return () => clearInterval(timer)
          }, [])

          const lastUpdated = currentTime.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          })

          return (
            <>
              <Clock className="w-3 h-3" />
              <span>Last updated: {lastUpdated}</span>
            </>
          )
        }
      })
    }, 0)
  })
})

interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  const [systemStatus, setSystemStatus] = React.useState("online")

  // Format current year (safe for both server and client)
  const currentYear = new Date().getFullYear()

  // Get system status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500"
      case "warning":
        return "bg-yellow-500"
      case "offline":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  // Get system status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <Circle className="w-2 h-2 fill-current text-green-500" />
      case "warning":
        return <Circle className="w-2 h-2 fill-current text-yellow-500" />
      case "offline":
        return <WifiOff className="w-3 h-3 text-red-500" />
      default:
        return <Circle className="w-2 h-2 fill-current text-gray-500" />
    }
  }

  return (
    <footer 
      className={cn(
        "relative w-full border-b bg-[#293963]",
        className
      )}
      role="contentinfo"
      aria-label="Application footer"
    >
      <div className="container mx-auto px-4 py-6 text-gray-400">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          
          {/* Brand and Copyright */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Retail POS System</h3>
                <p className="text-xs text-muted-foreground">v0.1.0</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>© {currentYear} Retail POS System</p>
              <p className="text-xs">All rights reserved</p>
            </div>
          </div>

          {/* Support Contact */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Support</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="w-4 h-4" />
                <a 
                  href={`mailto:${SUPPORT_CONTACTS.email}`}
                  className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                  aria-label={`Email support at ${SUPPORT_CONTACTS.email}`}
                >
                  {SUPPORT_CONTACTS.email}
                </a>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="w-4 h-4" />
                <a 
                  href={`tel:${SUPPORT_CONTACTS.phone}`}
                  className="hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                  aria-label={`Call support at ${SUPPORT_CONTACTS.phone}`}
                >
                  {SUPPORT_CONTACTS.phone}
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Quick Links</h4>
            <nav aria-label="Footer navigation">
              <ul className="space-y-2">
                {QUICK_LINKS.map((link) => {
                  const Icon = link.icon
                  return (
                    <li key={link.href}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-auto p-1 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        asChild
                      >
                        <a 
                          href={link.href}
                          className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-ring rounded"
                          aria-label={`Navigate to ${link.label}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{link.label}</span>
                        </a>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>

          {/* System Status */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">System Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-xs",
                    systemStatus === "online" ? "bg-green-500/20 text-green-700 dark:text-green-400" : 
                    systemStatus === "warning" ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                    "bg-red-500/20 text-red-700 dark:text-red-400"
                  )}
                >
                  <Circle className="w-2 h-2 mr-1 fill-current" />
                  {systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1)}
                </Badge>
                {getStatusIcon(systemStatus)}
              </div>
              
              <div className="space-y-1">
                {SYSTEM_COMPONENTS.map((component) => {
                  const Icon = component.icon
                  return (
                    <div 
                      key={component.name} 
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <div className="flex items-center space-x-1">
                        <Icon className="w-3 h-3" />
                        <span>{component.name}</span>
                      </div>
                      {getStatusIcon(component.status)}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <Suspense fallback={
              <>
                <Clock className="w-3 h-3" />
                <span>Last updated: Loading...</span>
              </>
            }>
              <ClientOnlyTimestamp />
            </Suspense>
          </div>
          
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <a 
              href="/privacy" 
              className="hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              Privacy Policy
            </a>
            <a 
              href="/terms" 
              className="hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded"
            >
              Terms of Service
            </a>
            <span>Built with ❤️ for retail excellence</span>
          </div>
        </div>
      </div>

      {/* Decorative gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </footer>
  )
}

export default Footer