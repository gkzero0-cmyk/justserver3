import type { MetadataRoute } from 'next'

import { readNotionIndex } from '@/lib/notion-index'
import { getSiteUrl } from '@/lib/site-url'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const index = await readNotionIndex()

  const pages: MetadataRoute.Sitemap = index.pages.map((page) => ({
    url:
      page.pageId === index.rootPageId
        ? siteUrl
        : `${siteUrl}/page/${page.pageId}`,
    lastModified: index.generatedAt ? new Date(index.generatedAt) : new Date(),
    changeFrequency: page.pageId === index.rootPageId ? 'daily' : 'weekly',
    priority: page.pageId === index.rootPageId ? 1 : 0.8
  }))

  return pages
}
