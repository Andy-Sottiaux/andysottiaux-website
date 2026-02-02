import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Andy Sottiaux - Software Engineer & Entrepreneur',
  description: 'Personal website of Andy Sottiaux showcasing skills, experience, and accomplishments in software engineering and entrepreneurship.',
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
