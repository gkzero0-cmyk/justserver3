import type { NotionIndexPage } from '@/lib/notion-index'
import {
  classifyWikiContent,
  type WikiContentStatus
} from '@/lib/wiki-ux'

export type { WikiContentStatus }

export function wikiContentStatus(
  page: Pick<NotionIndexPage, 'searchText'>
): WikiContentStatus {
  return classifyWikiContent(page)
}

export function isDraftPage(page: Pick<NotionIndexPage, 'searchText'>) {
  return wikiContentStatus(page) === 'draft'
}

export function isBriefPage(page: Pick<NotionIndexPage, 'searchText'>) {
  return wikiContentStatus(page) === 'brief'
}

export function isDetailedPage(page: Pick<NotionIndexPage, 'searchText'>) {
  return wikiContentStatus(page) === 'detailed'
}
