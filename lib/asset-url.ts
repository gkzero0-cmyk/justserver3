import { withBasePath } from '@/lib/base-path'

const RAW_ASSET_ORIGIN =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public'

export function resolveCachedAsset(pathname: string) {
  if (/^https?:\/\//i.test(pathname)) return pathname
  if (pathname.startsWith('/notion-assets/')) {
    return `${RAW_ASSET_ORIGIN}${pathname}`
  }
  return withBasePath(pathname)
}
