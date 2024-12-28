import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Beam Analysis Tool',
  description: 'Advanced beam analysis application for structural engineering',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}