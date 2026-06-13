import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "DriftFold Fixture",
  description: "A shadcn/cva app with deliberately planted className drift.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="mx-auto max-w-3xl space-y-8 p-8">{children}</body>
    </html>
  )
}
