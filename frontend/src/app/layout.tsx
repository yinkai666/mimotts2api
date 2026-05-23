import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MiMo TTS Proxy Manager',
  description: 'Manage MiMo TTS voices and configurations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
