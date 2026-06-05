import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MiMo TTS Proxy Manager',
  description: 'Manage MiMo TTS voices and configurations',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '64x64' },
    ],
    apple: '/apple-icon.png',
  },
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
