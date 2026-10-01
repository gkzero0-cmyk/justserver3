import type { NotionIndex, NotionIndexPage } from './notion-index.ts'

export const OFFICIAL_WIKI_ORIGIN = 'https://server1.wiki.xn--9i1bk7xhlfi8hzzf.com/'

const HIDDEN_CATEGORIES = new Set(['ADMIN', 'INTERNAL', 'DEV', 'DEVELOPER', 'SYSTEM', 'PRIVATE'])

type FansiteGuideGroup = {
  id: string
  title: string
  pages: NotionIndexPage[]
}

export const OFFICIAL_GUIDE_GROUPS = [
  { id: 'notice', title: '공지사항', pages: ['스토리', '서버규칙', '패치노트', 'API', '기초설정(뉴비필독)'] },
  { id: 'production', title: '생산 가이드', pages: ['채광', '낚시', '도축', '사냥', '요리'] },
  { id: 'content', title: '컨텐츠 도감', pages: ['도감', '파쿠르', '즉석복권', '경마장', '카지노'] },
  { id: 'etc', title: '기타 가이드', pages: ['땅 구매', '빚 갚기', '신용등급', '장비수리', '장비강화', '많이 물어보는 것'] }
] as const

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

export function buildFansiteGuideFeed(index: NotionIndex) {
  const pages = publicPages(index)
  const byTitle = new Map(pages.map((page) => [page.title, page]))
  const used = new Set<string>()
  const groups: FansiteGuideGroup[] = OFFICIAL_GUIDE_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    pages: group.pages
      .map((title) => byTitle.get(title))
      .filter((page): page is NotionIndexPage => Boolean(page))
      .map((page) => {
        used.add(page.pageId)
        return page
      })
  })).filter((group) => group.pages.length)

  const unmatched = pages.filter((page) => !used.has(page.pageId))
  if (unmatched.length) groups.push({ id: 'more', title: '기타 문서', pages: unmatched })

  return {
    schema: 'official-wiki-guide-v2',
    source: OFFICIAL_WIKI_ORIGIN,
    generatedAt: index.generatedAt || null,
    groups,
    pages: groups.flatMap((group) => group.pages)
  }
}
