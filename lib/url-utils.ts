export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') ?? ''

const RAW_ASSET_ORIGIN =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public'

export function withBasePath(pathname: string) {
  if (!pathname.startsWith('/')) return pathname
  if (!BASE_PATH) return pathname
  if (pathname === '/') return `${BASE_PATH}/`
  return `${BASE_PATH}${pathname}`
}

export function resolveCachedAsset(pathname: string) {
  if (/^https?:\/\//i.test(pathname)) return pathname
  if (pathname.startsWith('/notion-assets/')) {
    return `${RAW_ASSET_ORIGIN}${pathname}`
  }
  return withBasePath(pathname)
}

export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) return `https://${production.replace(/\/$/, '')}`

  const preview = process.env.VERCEL_URL?.trim()
  if (preview) return `https://${preview.replace(/\/$/, '')}`

  return 'http://localhost:3000'
}
