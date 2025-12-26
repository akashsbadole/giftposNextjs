import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs'
import { ClientLayout } from "@/components/layout/ClientLayout"

// Clerk Session Configuration
// Session duration is configured in Clerk Dashboard: https://dashboard.clerk.com
// Path: Configure → Sessions → Session length → Set to 15 days (1,296,000 seconds)
//
// Alternatively, configure via environment variables:
// NEXT_PUBLIC_CLERK_SESSION_DURATION=1296000
//
// For programmatic control, session duration should be set in Clerk Dashboard
// as it's the recommended and most reliable approach for production applications.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Retail POS System",
  description: "Point of Sale System for retail stores",
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        >
          <ClientLayout>
            {children}
          </ClientLayout>
        </body>
      </html>
    </ClerkProvider>
  );
}
