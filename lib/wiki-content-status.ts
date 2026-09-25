import type { NotionIndexPage } from '@/lib/notion-index'

const PLACEHOLDER_PATTERN = /위키\s*업데이트\s*예정|내용\s*추가\s*예정|작성\s*중/i

export function isDraftPage(page: Pick<NotionIndexPage, 'searchText'>) {
  const text = (page.searchText || '').replace(/\s+/g, ' ').trim()
  return PLACEHOLDER_PATTERN.test(text) || text.length < 80
}
