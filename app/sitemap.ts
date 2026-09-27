import type { MetadataRoute } from 'next'

import { readNotionIndex } from '@/lib/notion-index'
import { isDraftPage } from '@/lib/wiki-content-status'
import { getSiteUrl } from '@/lib/url-utils'
import { wikiGuidePath } from '@/lib/wiki-routes'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const index = await readNotionIndex()

  const indexablePages = index.pages.filter(
    (page) => page.pageId === index.rootPageId || !isDraftPage(page)
  )
  const validEditedTimes = indexablePages
    .map((page) => (page.lastEdited ? new Date(page.lastEdited).getTime() : 0))
    .filter((value) => Number.isFinite(value) && value > 0)
  const latestContentEdit = validEditedTimes.length
    ? new Date(Math.max(...validEditedTimes))
    : index.generatedAt
      ? new Date(index.generatedAt)
      : new Date()

  return indexablePages.map((page) => ({
    url:
      page.pageId === index.rootPageId
        ? siteUrl
        : `${siteUrl}${wikiGuidePath(page)}`,
    lastModified:
      page.pageId === index.rootPageId
        ? latestContentEdit
        : page.lastEdited
          ? new Date(page.lastEdited)
          : latestContentEdit,
    changeFrequency: page.pageId === index.rootPageId ? 'daily' : 'weekly',
    priority: page.pageId === index.rootPageId ? 1 : 0.8
  }))
}
