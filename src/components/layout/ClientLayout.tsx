'use client'

import { Footer } from "@/components/ui/footer"
import { SupportWidget } from "@/components/support/SupportWidget"
import { Toaster } from "@/components/ui/toaster"
import { SettingsProvider } from "@/lib/settings-context"



export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsProvider>
        <div className="flex flex-col min-h-screen">
          <main className="flex-1 w-full">
            {children}
          </main>
          <Footer />
        </div>
        <SupportWidget />
        <Toaster />
      </SettingsProvider>
    </>
  )
}