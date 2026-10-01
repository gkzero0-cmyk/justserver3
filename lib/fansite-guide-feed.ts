import type { NotionIndex, NotionIndexPage } from './notion-index.ts'

export const OFFICIAL_WIKI_ORIGIN = 'https://server1.wiki.xn--9i1bk7xhlfi8hzzf.com/'

const HIDDEN_CATEGORIES = new Set(['ADMIN', 'INTERNAL', 'DEV', 'DEVELOPER', 'SYSTEM', 'PRIVATE'])

function isPublicPage(page: NotionIndexPage) {
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

export function buildFansiteGuideFeed(index: NotionIndex) {
  return {
    source: OFFICIAL_WIKI_ORIGIN,
    generatedAt: index.generatedAt || null,
    pages: (Array.isArray(index.pages) ? index.pages : []).filter(isPublicPage)
  }
}
