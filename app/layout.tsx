import type { Metadata, Viewport } from 'next'
import 'react-notion-x/src/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '서버 위키',
    template: '%s | 서버 위키'
  },
  description: '공개 Notion을 기반으로 자동 갱신되는 서버 가이드 위키'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark'
}

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
