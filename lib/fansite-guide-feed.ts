import type { NotionIndex, NotionIndexPage } from './notion-index.ts'
import { WIKI_CATEGORIES, categoryForTitle, type WikiCategoryKey } from './wiki-taxonomy'

export const OFFICIAL_WIKI_ORIGIN = 'https://server1.wiki.xn--9i1bk7xhlfi8hzzf.com/'

const HIDDEN_CATEGORIES = new Set(['ADMIN', 'INTERNAL', 'DEV', 'DEVELOPER', 'SYSTEM', 'PRIVATE'])
const LIVE_WIKI_GROUP_ORDER: WikiCategoryKey[] = ['start', 'content', 'growth']

type FansiteGuideGroup = {
  id: string
  title: string
  pages: NotionIndexPage[]
}

export function isPublicGuidePage(page: NotionIndexPage) {
  const row = page as NotionIndexPage & {
    category?: string | null
    visibility?: string | null
    private?: boolean
    published?: boolean
  }
  const category = String(row.category || '').trim().toUpperCase()
  if (HIDDEN_CATEGORIES.has(category)) return false
  if (row.visibility === 'internal' || row.private === true || row.published === false) return false
  if (/^(?:ADMIN|INTERNAL|DEV|DEVELOPER|SYSTEM|PRIVATE)$/i.test(String(row.title || '').trim())) return false
  return Boolean(String(row.pageId || '').trim() && String(row.title || '').trim())
}

function publicPages(index: NotionIndex) {
  const rootId = String(index.rootPageId || '').replaceAll('-', '')
  return (Array.isArray(index.pages) ? index.pages : [])
    .filter(isPublicGuidePage)
    .filter((page) => String(page.pageId || '').replaceAll('-', '') !== rootId)
}

function liveWikiCategoryForPage(page: NotionIndexPage): WikiCategoryKey {
  const row = page as NotionIndexPage & { category?: string | null }
  const explicit = String(row.category || '').trim()
  const matched = LIVE_WIKI_GROUP_ORDER.find((key) => WIKI_CATEGORIES[key].title === explicit)
  return matched || categoryForTitle(page.title)
}

export function buildFansiteGuideFeed(index: NotionIndex) {
  const pages = publicPages(index)
  const groups: FansiteGuideGroup[] = LIVE_WIKI_GROUP_ORDER
    .map((groupId) => ({
      id: groupId,
      title: WIKI_CATEGORIES[groupId].title,
      pages: pages.filter((page) => liveWikiCategoryForPage(page) === groupId)
    }))
    .filter((group) => group.pages.length)

  return {
    schema: 'official-wiki-guide-v2',
    source: OFFICIAL_WIKI_ORIGIN,
    generatedAt: index.generatedAt || null,
    groups,
    pages
  }
}
