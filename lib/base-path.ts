export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') ?? ''

export function withBasePath(pathname: string) {
  if (!pathname.startsWith('/')) return pathname
  if (!BASE_PATH) return pathname
  if (pathname === '/') return `${BASE_PATH}/`
  return `${BASE_PATH}${pathname}`
}
