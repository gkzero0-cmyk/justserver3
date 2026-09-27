import type { NextConfig } from 'next'

import { WIKI_GUIDE_ROUTES } from './lib/wiki-routes'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
]

const mutableIndexCacheHeader = {
  key: 'Cache-Control',
  value: 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800'
}

const immutableAssetCacheHeader = {
  key: 'Cache-Control',
  value: 'public, max-age=31536000, immutable'
}

const nextConfig: NextConfig = {
  ...(!isGitHubPages
    ? {
        async headers() {
          return [
            {
              source: '/notion-assets/optimized/:path*',
              headers: [immutableAssetCacheHeader]
            },
            {
              source: '/notion-assets/search-index.json',
              headers: [mutableIndexCacheHeader]
            },
            {
              source: '/notion-assets/index.json',
              headers: [mutableIndexCacheHeader]
            },
            {
              source: '/notion-assets/display-manifest.json',
              headers: [mutableIndexCacheHeader]
            },
            {
              source: '/notion-assets/manifest.json',
              headers: [mutableIndexCacheHeader]
            },
            {
              source: '/:path*',
              headers: securityHeaders
            }
          ]
        }
      }
    : {}),
  ...(isGitHubPages
    ? {
        output: 'export' as const,
        trailingSlash: true,
        basePath,
        assetPrefix: basePath
      }
    : {}),
  ...(!isGitHubPages
    ? {
        async redirects() {
          return WIKI_GUIDE_ROUTES.map(({ pageId, slug }) => ({
            source: `/page/${pageId}`,
            destination: `/guide/${slug}/`,
            permanent: true
          }))
        }
      }
    : {}),
  images: {
    unoptimized: isGitHubPages,
    remotePatterns: [
      { protocol: 'https', hostname: 'prod-files-secure.s3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 's3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 'www.notion.so' },
      { protocol: 'https', hostname: 'notion.so' },
      { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  }
}

export default nextConfig
