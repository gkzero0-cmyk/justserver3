import {
  classifyWikiContent,
  type WikiContentStatus
} from '@/lib/wiki-ux'

export type { WikiContentStatus }

type WikiStatusPage = {
  title?: string | null
  searchText?: string | null
  status?: WikiContentStatus | null
}

export function wikiContentStatus(
  page: WikiStatusPage
): WikiContentStatus {
  if (page.title === '장비강화') return 'brief'
  return classifyWikiContent(page)
}

export function isDraftPage(page: WikiStatusPage) {
  return wikiContentStatus(page) === 'draft'
}

export function isBriefPage(page: WikiStatusPage) {
  return wikiContentStatus(page) === 'brief'
}

export function isDetailedPage(page: WikiStatusPage) {
  return wikiContentStatus(page) === 'detailed'
}
