import Link from 'next/link'

import type { NotionIndexPage } from '@/lib/notion-index'
import { categoryAnchorForTitle, categoryTitleForPage } from '@/lib/wiki-taxonomy'
import { withBasePath } from '@/lib/url-utils'

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export function WikiPageNavigation({
  current,
  pages,
  mode = 'context'
}: {
  current: NotionIndexPage | null
  pages: NotionIndexPage[]
  mode?: 'context' | 'siblings'
}) {
  if (!current) return null

  const currentIndex = pages.findIndex((page) => page.pageId === current.pageId)
  const previous = currentIndex > 0 ? pages[currentIndex - 1] : null
  const next =
    currentIndex >= 0 && currentIndex < pages.length - 1
      ? pages[currentIndex + 1]
      : null
  const category = categoryTitleForPage(current.title)
  const updatedAt = formatDate(current.lastEdited)

  if (mode === 'siblings') {
    return (
      <nav className="page-siblings page-siblings-bottom" aria-label="이전 및 다음 문서">
        {previous ? (
          <Link href={withBasePath(`/page/${previous.pageId}/`)}>
            <small>← 이전 문서</small>
            <strong>{previous.title}</strong>
          </Link>
        ) : (
          <span />
        )}

        {next ? (
          <Link
            href={withBasePath(`/page/${next.pageId}/`)}
            className="page-sibling-next"
          >
            <small>다음 문서 →</small>
            <strong>{next.title}</strong>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    )
  }

  return (
    <div className="page-context">
      <nav className="breadcrumbs" aria-label="현재 위치">
        <Link href={withBasePath('/')} prefetch={false}>위키 홈</Link>
        <span>›</span>
        <Link href={withBasePath(`/#${categoryAnchorForTitle(current.title)}`)} prefetch={false}>{category}</Link>
        <span>›</span>
        <strong>{current.title}</strong>
      </nav>
      {updatedAt && <span className="page-updated">최근 수정 {updatedAt}</span>}
    </div>
  )
}
