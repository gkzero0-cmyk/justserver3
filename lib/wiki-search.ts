import {
  classifyWikiContent,
  matchesKoreanInitials,
  type WikiContentStatus
} from './wiki-ux.ts'

export type WikiSearchSection = {
  heading: string
  anchor: string
  text: string
}

export type WikiSearchPage = {
  pageId: string
  title: string
  category?: string | null
  status?: WikiContentStatus
  searchText?: string
  sections?: WikiSearchSection[]
  snippet?: string
  findTerm?: string
  sectionTitle?: string
  anchor?: string
  resultKey?: string
  score?: number
}

export type WikiSearchIndexPayload = {
  generatedAt?: string
  pages?: WikiSearchPage[]
}

export const WIKI_SEARCH_PRIORITY = [
  '서버규칙',
  '기초설정(뉴비필독)',
  '채광',
  '스토리',
  'API',
  '요리',
  '사냥',
  '땅 구매'
]

const SEARCH_ALIASES: Record<string, string[]> = {
  초보: ['뉴비', '기초'],
  뉴비: ['초보', '기초'],
  돈: ['경제', '빚', '채광'],
  돈벌이: ['채광', '경제'],
  광질: ['채광'],
  강화석: ['강화'],
  장비: ['강화', '수리'],
  룰: ['규칙'],
  규정: ['규칙'],
  질문: ['많이 물어보는 것', 'faq']
}

export function wikiSearchPageStatus(page: WikiSearchPage) {
  if (page.status) return page.status
  const text = (page.searchText || '').replace(/\s+/g, ' ').trim()
  return text ? classifyWikiContent(page) : null
}

function editDistance(left: string, right: string) {
  const a = [...left]
  const b = [...right]
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      previous = saved
    }
  }

  return row[b.length]
}

export function expandedWikiSearchTerms(keyword: string) {
  const normalized = keyword.trim().toLowerCase()
  const terms = new Set([normalized])

  for (const [alias, values] of Object.entries(SEARCH_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      for (const value of values) terms.add(value.toLowerCase())
    }
  }

  return [...terms].filter(Boolean)
}

function priorityOf(page: WikiSearchPage) {
  const index = WIKI_SEARCH_PRIORITY.indexOf(page.title)
  return index >= 0 ? index : 100
}

function statusRank(page: WikiSearchPage) {
  const status = wikiSearchPageStatus(page)
  return status === 'draft' ? 2 : status === 'brief' ? 1 : 0
}

function snippetAround(text: string, term: string) {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const lower = normalizedText.toLowerCase()
  const index = lower.indexOf(term.toLowerCase())
  if (index < 0) return normalizedText.slice(0, 150)

  const start = Math.max(0, index - 48)
  const end = Math.min(
    normalizedText.length,
    index + term.length + 82
  )

  return `${start > 0 ? '…' : ''}${normalizedText.slice(start, end)}${end < normalizedText.length ? '…' : ''}`
}

export function buildWikiSearchResults(
  source: WikiSearchPage[],
  query: string,
  limit = 16
) {
  const keyword = query.trim().toLowerCase()
  const terms = expandedWikiSearchTerms(keyword)

  if (!keyword) {
    return [...source]
      .sort((a, b) => {
        const statusDiff = statusRank(a) - statusRank(b)
        if (statusDiff) return statusDiff
        return priorityOf(a) - priorityOf(b)
      })
      .slice(0, Math.max(0, limit))
      .map((page) => ({
        ...page,
        snippet: '',
        resultKey: `${page.pageId}:page`
      }))
  }

  const results: WikiSearchPage[] = []

  for (const page of source) {
    const title = page.title.toLowerCase()
    const searchText = page.searchText ?? ''
    const body = searchText.toLowerCase()
    const initialMatch = matchesKoreanInitials(page.title, keyword)
    const fuzzyTitleMatch =
      keyword.length >= 3 &&
      title
        .split(/[\s()·:_-]+/)
        .filter(Boolean)
        .some(
          (word) =>
            Math.abs(word.length - keyword.length) <= 1 &&
            editDistance(word, keyword) <= 1
        )
    const titleTerm = terms.find((term) => title.includes(term)) || null
    const titleExact = title === keyword
    const titleMatch = Boolean(titleTerm)
    const statusPenalty =
      statusRank(page) === 2 ? 1000 : statusRank(page) === 1 ? 80 : 0

    if (titleMatch || initialMatch || fuzzyTitleMatch) {
      results.push({
        ...page,
        snippet: '',
        findTerm: '',
        resultKey: `${page.pageId}:page`,
        score:
          statusPenalty +
          (titleExact
            ? 0
            : titleMatch
              ? 8
              : initialMatch
                ? 14
                : 20) +
          priorityOf(page)
      })
    }

    const sectionMatches: WikiSearchPage[] = []
    for (const section of page.sections || []) {
      const heading = section.heading.toLowerCase()
      const sectionText = section.text || ''
      const sectionBody = sectionText.toLowerCase()
      const headingTerm =
        terms.find((term) => heading.includes(term)) || null
      const bodyTerm =
        terms.find((term) => sectionBody.includes(term)) || null
      const term = headingTerm || bodyTerm

      if (!term || (!section.heading && !section.anchor)) continue

      const headingExact = heading === keyword
      const score =
        statusPenalty +
        (headingExact ? 4 : headingTerm ? 12 : 32) +
        priorityOf(page)

      sectionMatches.push({
        ...page,
        sectionTitle: section.heading || '본문',
        anchor: section.anchor || undefined,
        findTerm: term,
        snippet: sectionText
          ? snippetAround(sectionText, term)
          : section.heading,
        resultKey: `${page.pageId}:${section.anchor || section.heading}`,
        score
      })
    }

    sectionMatches.sort((a, b) => (a.score || 0) - (b.score || 0))
    sectionMatches.splice(3)
    results.push(...sectionMatches)

    if (
      !titleMatch &&
      !initialMatch &&
      !fuzzyTitleMatch &&
      sectionMatches.length === 0
    ) {
      const bodyTerm = terms.find((term) => body.includes(term)) || null
      if (bodyTerm) {
        results.push({
          ...page,
          snippet: snippetAround(searchText, bodyTerm),
          findTerm: bodyTerm,
          resultKey: `${page.pageId}:body`,
          score: statusPenalty + 44 + priorityOf(page)
        })
      }
    }
  }

  return results
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .slice(0, Math.max(0, limit))
}
