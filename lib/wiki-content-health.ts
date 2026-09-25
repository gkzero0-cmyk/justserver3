export type WikiHealthStatus = 'draft' | 'brief' | 'detailed'

export type WikiHealthPage = {
  pageId: string
  title: string
  searchText?: string | null
  status?: WikiHealthStatus | null
  lastEdited?: string | null
}

export type WikiContentHealth = {
  pageId: string
  title: string
  status: WikiHealthStatus
  score: number
  textLength: number
  stage: 'source-needed' | 'expand' | 'maintain'
  issues: string[]
  nextAction: string
}

const PLACEHOLDER_PATTERN =
  /위키\s*업데이트\s*예정|내용\s*추가\s*예정|작성\s*중/i

const CORE_BACKLOG_TITLES = new Set([
  '도감',
  '빚 갚기',
  '신용등급',
  '장비수리',
  '장비강화',
  '많이 물어보는 것'
])

function compactText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function inferStatus(page: WikiHealthPage): WikiHealthStatus {
  if (
    page.status === 'draft' ||
    page.status === 'brief' ||
    page.status === 'detailed'
  ) {
    return page.status
  }

  const text = compactText(page.searchText)
  if (PLACEHOLDER_PATTERN.test(text) || text.length < 80) return 'draft'
  if (text.length < 220) return 'brief'
  return 'detailed'
}

export function wikiContentHealth(
  page: WikiHealthPage
): WikiContentHealth {
  const text = compactText(page.searchText)
  const status = inferStatus(page)
  const placeholder = PLACEHOLDER_PATTERN.test(text)
  const issues: string[] = []
  let score = 0

  if (placeholder) {
    score += 100
    issues.push('원문이 업데이트 예정 상태')
  } else if (status === 'draft') {
    score += 82
    issues.push('본문 정보가 매우 적음')
  } else if (status === 'brief') {
    score += 48
    issues.push('핵심 설명만 있는 간단 문서')
  } else {
    score += 8
  }

  if (text.length < 120) {
    score += 14
    if (!issues.includes('본문 정보가 매우 적음')) {
      issues.push('설명 분량이 짧음')
    }
  }

  if (CORE_BACKLOG_TITLES.has(page.title) && status !== 'detailed') {
    score += 18
    issues.push('핵심 플레이 흐름과 연결되는 문서')
  }

  const stage =
    placeholder || status === 'draft'
      ? 'source-needed'
      : status === 'brief'
        ? 'expand'
        : 'maintain'

  const nextAction =
    stage === 'source-needed'
      ? '공식 원문·공지에서 사실과 수치를 확인한 뒤 본문 후보를 추가'
      : stage === 'expand'
        ? '조건·보상·주의사항·연결 문서를 보강'
        : '최근 변경 여부와 링크 정확도만 점검'

  return {
    pageId: page.pageId,
    title: page.title,
    status,
    score,
    textLength: text.length,
    stage,
    issues: [...new Set(issues)],
    nextAction
  }
}

export function buildWikiContentBacklog(
  pages: WikiHealthPage[],
  limit = pages.length
) {
  return pages
    .map(wikiContentHealth)
    .filter((item) => item.stage !== 'maintain')
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.textLength - b.textLength ||
        a.title.localeCompare(b.title, 'ko')
    )
    .slice(0, Math.max(0, limit))
}

export function wikiContentReadiness(pages: WikiHealthPage[]) {
  const health = pages.map(wikiContentHealth)
  const total = health.length
  const detailed = health.filter((item) => item.status === 'detailed').length
  const brief = health.filter((item) => item.status === 'brief').length
  const draft = health.filter((item) => item.status === 'draft').length

  return {
    total,
    detailed,
    brief,
    draft,
    ready: detailed + brief,
    percent: total
      ? Math.round(((detailed + brief) / total) * 100)
      : 0
  }
}
