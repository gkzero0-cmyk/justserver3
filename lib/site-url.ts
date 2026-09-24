export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) return `https://${production.replace(/\/$/, '')}`

  const preview = process.env.VERCEL_URL?.trim()
  if (preview) return `https://${preview.replace(/\/$/, '')}`

  return 'http://localhost:3000'
}
