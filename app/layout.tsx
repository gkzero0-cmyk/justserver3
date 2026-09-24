import type { Metadata, Viewport } from 'next'
import 'react-notion-x/src/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '그냥서버 : 적자생존 공식 위키',
    template: '%s | 그냥서버 : 적자생존 공식 위키'
  },
  description:
    '그냥서버 : 적자생존의 서버 규칙, 시스템, 아이템, 콘텐츠와 각종 가이드를 모아보는 공식 위키입니다.',
  applicationName: '그냥서버 : 적자생존 공식 위키',
  category: 'game guide',
  openGraph: {
    title: '그냥서버 : 적자생존 공식 위키',
    description:
      '서버 규칙과 주요 시스템을 빠르게 찾아볼 수 있는 자동 동기화 공식 위키',
    type: 'website',
    locale: 'ko_KR'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
  themeColor: '#0a0d12'
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
