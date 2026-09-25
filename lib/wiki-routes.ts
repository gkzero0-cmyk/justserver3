const WIKI_ROUTE_ENTRIES = [
  ['3dad57d6a55c802a99dcf9704ef883f3', '스토리', 'story'],
  ['3dad57d6a55c802aa11adaed7c2c98ff', '서버규칙', 'rules'],
  ['3e0d57d6a55c80199479ddd73ea6ace4', '패치노트', 'patch-notes'],
  ['3dad57d6a55c80f28689c7bebde648fe', 'API', 'api'],
  ['3e0d57d6a55c80e5af78cf3a2ef9ef7e', '기초설정(뉴비필독)', 'newbie-guide'],
  ['3dad57d6a55c807d8738ee94e33d7b13', '채광', 'mining'],
  ['3dad57d6a55c80c0b4adc2aa5676076b', '낚시', 'fishing'],
  ['3e0d57d6a55c80449496e2d2e8c1d907', '도축', 'butchering'],
  ['3e0d57d6a55c80918231cba5c2668bf9', '사냥', 'hunting'],
  ['3e0d57d6a55c80c5a8afe20753a11db1', '요리', 'cooking'],
  ['3e0d57d6a55c80689cfed899c1dc67f6', '도감', 'collection'],
  ['3e0d57d6a55c80acb206ece6646c102a', '파쿠르', 'parkour'],
  ['3e0d57d6a55c800a9fecf571a901c9bb', '즉석복권', 'scratch-lottery'],
  ['3e0d57d6a55c804dbcd3dff1fed6eb68', '경마장', 'racecourse'],
  ['3e0d57d6a55c80378750e502be28b30f', '카지노', 'casino'],
  ['3e0d57d6a55c80f89a7df3aabc93ca53', '땅 구매', 'land'],
  ['3e0d57d6a55c80f4bd26e6c22516eb8a', '빚 갚기', 'debt'],
  ['3ddd57d6a55c80d1a126c09593be5d6e', '신용등급', 'credit'],
  ['3e0d57d6a55c8066b139d896b3c40081', '장비수리', 'repair'],
  ['3e0d57d6a55c80fc99eef96b991ea5df', '장비강화', 'upgrade'],
  ['3e0d57d6a55c80aa89daee3da173adf7', '많이 물어보는 것', 'faq']
] as const

const slugById = new Map<string, string>(
  WIKI_ROUTE_ENTRIES.map(([pageId, , slug]) => [pageId, slug])
)
const idBySlug = new Map<string, string>(
  WIKI_ROUTE_ENTRIES.map(([pageId, , slug]) => [slug, pageId])
)
const slugByTitle = new Map<string, string>(
  WIKI_ROUTE_ENTRIES.map(([, title, slug]) => [title, slug])
)

export function normalizeWikiPageId(value: string) {
  return value.replaceAll('-', '').toLowerCase()
}

export function wikiSlugForPageId(pageId: string | null | undefined) {
  if (!pageId) return null
  return slugById.get(normalizeWikiPageId(pageId)) ?? null
}

export function wikiSlugForTitle(title: string | null | undefined) {
  if (!title) return null
  return slugByTitle.get(title) ?? null
}

export function wikiPageIdForSlug(slug: string | null | undefined) {
  if (!slug) return null
  return idBySlug.get(slug.toLowerCase()) ?? null
}

export function wikiGuidePath(page: { pageId: string; title?: string | null }) {
  const slug =
    wikiSlugForTitle(page.title) ||
    wikiSlugForPageId(page.pageId)

  return slug
    ? `/guide/${slug}/`
    : `/page/${normalizeWikiPageId(page.pageId)}/`
}

export function canonicalizeWikiPath(pathname: string) {
  const match = pathname.match(/^\/page\/([0-9a-f-]{32,36})\/?$/i)
  if (!match) return pathname

  const slug = wikiSlugForPageId(match[1])
  return slug ? `/guide/${slug}/` : pathname
}

export const WIKI_GUIDE_ROUTES = WIKI_ROUTE_ENTRIES.map(
  ([pageId, title, slug]) => ({ pageId, title, slug })
)
