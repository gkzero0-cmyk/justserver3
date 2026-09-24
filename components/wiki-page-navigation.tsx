import type { NotionIndexPage } from '@/lib/notion-index'
import { withBasePath } from '@/lib/base-path'
import { categoryForTitle, WIKI_CATEGORIES } from '@/lib/wiki-taxonomy'

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
  pages
}: {
  current: NotionIndexPage | null
  pages: NotionIndexPage[]
}) {
  if (!current) return null

  const currentIndex = pages.findIndex((page) => page.pageId === current.pageId)
  const previous = currentIndex > 0 ? pages[currentIndex - 1] : null
  const next =
    currentIndex >= 0 && currentIndex < pages.length - 1
      ? pages[currentIndex + 1]
      : null
  const category = WIKI_CATEGORIES[categoryForTitle(current.title)]
  const updatedAt = formatDate(current.lastEdited)

  return (
    <>
      <div className="page-context">
        <nav className="breadcrumbs" aria-label="현재 위치">
          <a href={withBasePath('/')}>위키 홈</a>
          <span>›</span>
          <span>{category.title}</span>
          <span>›</span>
          <strong>{current.title}</strong>
        </nav>
        {updatedAt && <span className="page-updated">최근 수정 {updatedAt}</span>}
      </div>

      <nav className="page-siblings" aria-label="이전 및 다음 문서">
        {previous ? (
          <a href={withBasePath(`/page/${previous.pageId}/`)}>
            <small>← 이전 문서</small>
            <strong>{previous.title}</strong>
          </a>
        ) : (
          <span />
        )}

        {next ? (
          <a
            href={withBasePath(`/page/${next.pageId}/`)}
            className="page-sibling-next"
          >
            <small>다음 문서 →</small>
            <strong>{next.title}</strong>
          </a>
        ) : (
          <span />
        )}
      </nav>
    </>
  )
}
