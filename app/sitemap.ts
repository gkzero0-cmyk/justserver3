import type { MetadataRoute } from 'next'

import { readNotionIndex } from '@/lib/notion-index'
import { isDraftPage } from '@/lib/wiki-content-status'
import { getSiteUrl } from '@/lib/url-utils'
import { wikiGuidePath } from '@/lib/wiki-routes'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const index = await readNotionIndex()

  const pages: MetadataRoute.Sitemap = index.pages
    .filter((page) => page.pageId === index.rootPageId || !isDraftPage(page))
    .map((page) => ({
    url:
      page.pageId === index.rootPageId
        ? siteUrl
        : `${siteUrl}${wikiGuidePath(page)}`,
    lastModified: page.lastEdited
      ? new Date(page.lastEdited)
      : index.generatedAt
        ? new Date(index.generatedAt)
        : new Date(),
    changeFrequency: page.pageId === index.rootPageId ? 'daily' : 'weekly',
    priority: page.pageId === index.rootPageId ? 1 : 0.8
  }))

  return pages
}
