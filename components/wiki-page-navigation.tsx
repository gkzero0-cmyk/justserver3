import type { NotionIndexPage } from '@/lib/notion-index'
import { withBasePath } from '@/lib/base-path'

function categoryTitle(title: string) {
  const value = title.toLowerCase()

  if (
    value.includes('스토리') ||
    value.includes('규칙') ||
    value.includes('패치') ||
    value.includes('api') ||
    value.includes('뉴비') ||
    value.includes('기초')
  ) {
    return '시작하기'
  }

  if (
    value.includes('땅') ||
    value.includes('빚') ||
    value.includes('신용') ||
    value.includes('수리') ||
    value.includes('강화') ||
    value.includes('물어보는')
  ) {
    return '성장 · 경제'
  }

  return '주요 콘텐츠'
}

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
  const category = categoryTitle(current.title)
  const updatedAt = formatDate(current.lastEdited)

  if (mode === 'siblings') {
    return (
      <nav className="page-siblings page-siblings-bottom" aria-label="이전 및 다음 문서">
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
    )
  }

  return (
    <div className="page-context">
      <nav className="breadcrumbs" aria-label="현재 위치">
        <a href={withBasePath('/')}>위키 홈</a>
        <span>›</span>
        <span>{category}</span>
        <span>›</span>
        <strong>{current.title}</strong>
      </nav>
      {updatedAt && <span className="page-updated">최근 수정 {updatedAt}</span>}
    </div>
  )
}
