import { withBasePath } from '@/lib/base-path'

export function resolveCachedAsset(pathname: string) {
  if (/^https?:\/\//i.test(pathname)) return pathname
  return withBasePath(pathname)
}
