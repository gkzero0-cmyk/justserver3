import { canonicalizeWikiPath } from '@/lib/wiki-routes'

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') ?? ''

const CDN_ASSET_ORIGIN =
  'https://cdn.jsdelivr.net/gh/gkzero0-cmyk/justserver3@main/public'

export function withBasePath(pathname: string) {
  if (!pathname.startsWith('/')) return pathname

  const canonicalPath = canonicalizeWikiPath(pathname)

  if (!BASE_PATH) return canonicalPath
  if (canonicalPath === '/') return `${BASE_PATH}/`
  return `${BASE_PATH}${canonicalPath}`
}

export function deriveOptimizedVariant(
  pathname: string | null | undefined,
  kind: 'thumb256' | 'hero768' | 'hero1280' | 'hero1600'
) {
  if (!pathname) return null

  const match = pathname.match(
    /\/notion-assets\/optimized\/(?:[^/]+\/)?([0-9a-f]{24})\.webp$/i
  )
  if (!match) return null

  return `/notion-assets/optimized/${kind}/${match[1]}.webp`
}

export function resolveCachedAsset(pathname: string) {
  if (/^https?:\/\//i.test(pathname)) return pathname
  if (pathname.startsWith('/notion-assets/')) {
    return `${CDN_ASSET_ORIGIN}${pathname}`
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
