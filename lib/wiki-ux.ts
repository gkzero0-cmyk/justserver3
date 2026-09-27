export type WikiContentStatus = 'draft' | 'brief' | 'detailed'

const PLACEHOLDER_PATTERN =
  /위키\s*업데이트\s*예정|내용\s*추가\s*예정|작성\s*중/i

const INITIALS = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
  'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
] as const

function compactText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

export function classifyWikiContent(page: {
  searchText?: string | null
  status?: WikiContentStatus | null
}): WikiContentStatus {
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

export function extractKoreanInitials(value: string) {
  let result = ''
  for (const character of value.normalize('NFC')) {
    const code = character.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const index = Math.floor((code - 0xac00) / 588)
      result += INITIALS[index] || character
      continue
    }
    if (/[ㄱ-ㅎ]/.test(character)) {
      result += character
    }
  }
  return result
}

export function matchesKoreanInitials(value: string, query: string) {
  const normalized = query.replace(/\s+/g, '')
  if (!normalized || !/^[ㄱ-ㅎ]+$/.test(normalized)) return false
  return extractKoreanInitials(value).includes(normalized)
}

export function updateRecentPageIds(
  existing: string[],
  pageId: string,
  limit = 5
) {
  const normalized = pageId.replaceAll('-', '')
  const next = [
    normalized,
    ...existing
      .map((value) => value.replaceAll('-', ''))
      .filter((value) => value && value !== normalized)
  ]
  return next.slice(0, Math.max(1, limit))
}

function seoulDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

function calendarDayNumber(value: Date) {
  const [year, month, day] = seoulDateKey(value).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86400000
}

export function relativeUpdateLabel(
  value: string | null | undefined,
  now = new Date()
) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const days = calendarDayNumber(now) - calendarDayNumber(date)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul'
  }).format(date)
}


export function suggestFallbackPages<
  T extends {
    pageId: string
    title: string
    searchText?: string | null
    status?: WikiContentStatus | null
  }
>(
  pages: T[],
  priorityTitles: string[],
  limit = 3
) {
  const priority = new Map(
    priorityTitles.map((title, index) => [title, index])
  )

  return [...pages]
    .filter((page) => classifyWikiContent(page) !== 'draft')
    .sort((a, b) => {
      const aPriority = priority.get(a.title) ?? 999
      const bPriority = priority.get(b.title) ?? 999
      if (aPriority !== bPriority) return aPriority - bPriority

      const aStatus = classifyWikiContent(a)
      const bStatus = classifyWikiContent(b)
      if (aStatus !== bStatus) {
        return aStatus === 'detailed' ? -1 : 1
      }

      return a.title.localeCompare(b.title, 'ko')
    })
    .slice(0, Math.max(1, limit))
}


export function wikiHeadingId(text: string, occurrence = 1) {
  const base =
    text
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '') || 'section'

  return occurrence > 1 ? `${base}-${occurrence}` : base
}
