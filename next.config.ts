import type { NextConfig } from 'next'

import { WIKI_GUIDE_ROUTES } from './lib/wiki-routes'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig: NextConfig = {
  ...(!isGitHubPages
    ? {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                {
                  key: 'Permissions-Policy',
                  value: 'camera=(), microphone=(), geolocation=()'
                }
              ]
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
