import type { Metadata, Viewport } from 'next'
import 'react-notion-x/src/styles.css'
import './globals.css'
import { getSiteUrl } from '@/lib/url-utils'

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: '그냥서버 : 적자생존 공식 위키',
    template: '%s | 그냥서버 : 적자생존 공식 위키'
  },
  description:
    '그냥서버 : 적자생존의 서버 규칙, 시스템, 아이템, 콘텐츠와 각종 가이드를 모아보는 공식 위키입니다.',
  applicationName: '그냥서버 : 적자생존 공식 위키',
  icons: {
    icon: 'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/optimized/logo64/da97a92ed58d144e4aacf9ec.webp',
    shortcut: 'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/optimized/logo64/da97a92ed58d144e4aacf9ec.webp',
    apple: 'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/optimized/logo64/da97a92ed58d144e4aacf9ec.webp'
  },
  category: 'game guide',
  openGraph: {
    title: '그냥서버 : 적자생존 공식 위키',
    description:
      '서버 규칙과 주요 시스템을 빠르게 찾아볼 수 있는 그냥서버 : 적자생존 공식 위키',
    type: 'website',
    locale: 'ko_KR'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#09090a' },
    { media: '(prefers-color-scheme: light)', color: '#f2ede5' }
  ]
}

const themeScript = `
  try {
    const saved = localStorage.getItem('justserver3-theme');
    const theme = saved === 'light' || saved === 'dark'
      ? saved
      : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;
  } catch {}
`

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
