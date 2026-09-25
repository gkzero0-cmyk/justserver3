export type ReadingGamePage = {
  pageId: string
  title: string
  category?: string | null
  searchText?: string | null
}

function normalizeId(value: string) {
  return value.replaceAll('-', '').trim()
}

function stableHash(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function uniqueReadingIds(values: string[]) {
  return [
    ...new Set(values.map(normalizeId).filter(Boolean))
  ]
}

export function readingCollectionSets(
  pages: ReadingGamePage[],
  readIds: string[]
) {
  const read = new Set(uniqueReadingIds(readIds))
  const definitions = [
    {
      category: '시작하기',
      icon: '🧭',
      title: '초보 생존 세트',
      description: '처음 시작할 때 필요한 핵심 문서'
    },
    {
      category: '주요 콘텐츠',
      icon: '🎮',
      title: '콘텐츠 탐험 세트',
      description: '서버에서 즐길 수 있는 주요 콘텐츠'
    },
    {
      category: '성장 · 경제',
      icon: '📈',
      title: '경제 · 성장 세트',
      description: '돈과 장비 성장에 필요한 가이드'
    }
  ]

  return definitions
    .map((definition) => {
      const targets = pages.filter(
        (page) => (page.category || '기타') === definition.category
      )
      const completed = targets.filter((page) =>
        read.has(normalizeId(page.pageId))
      ).length
      return {
        ...definition,
        count: completed,
        total: targets.length,
        percent: targets.length
          ? Math.round((completed / targets.length) * 100)
          : 0,
        complete: targets.length > 0 && completed === targets.length
      }
    })
    .filter((set) => set.total > 0)
}

export function dailyExplorationQuest(
  pages: ReadingGamePage[],
  dateKey: string
) {
  if (!pages.length) {
    return {
      id: 'empty',
      icon: '🧭',
      title: '오늘의 탐험',
      description: '준비된 가이드가 추가되면 탐험 루트가 열립니다.',
      pages: [] as ReadingGamePage[]
    }
  }

  const grouped = new Map<string, ReadingGamePage[]>()
  for (const page of pages) {
    const category = page.category || '기타'
    grouped.set(category, [...(grouped.get(category) || []), page])
  }

  const categories = [...grouped.keys()].sort()
  const category =
    categories[stableHash('quest-category:' + dateKey) % categories.length]
  const candidates = [...(grouped.get(category) || [])]
    .sort(
      (left, right) =>
        stableHash(dateKey + ':' + left.pageId) -
        stableHash(dateKey + ':' + right.pageId)
    )
    .slice(0, 3)

  const labels: Record<
    string,
    { icon: string; title: string; description: string }
  > = {
    시작하기: {
      icon: '🧭',
      title: '오늘의 의뢰 · 생존 준비',
      description: '처음 시작할 때 알아두면 좋은 문서를 차례로 확인하세요.'
    },
    '주요 콘텐츠': {
      icon: '🎮',
      title: '오늘의 의뢰 · 콘텐츠 탐험',
      description: '서버의 주요 콘텐츠를 따라가며 탐험도를 올려보세요.'
    },
    '성장 · 경제': {
      icon: '💰',
      title: '오늘의 의뢰 · 적자 탈출',
      description: '경제와 성장 문서를 읽고 생존 루트를 완성하세요.'
    }
  }

  const label = labels[category] || {
    icon: '🗺️',
    title: '오늘의 의뢰 · 위키 탐험',
    description: '추천된 문서를 읽고 오늘의 탐험을 완료하세요.'
  }

  return {
    id: category + ':' + dateKey,
    ...label,
    pages: candidates
  }
}

export function unreadRecommendations(
  pages: ReadingGamePage[],
  readIds: string[],
  limit = 3
) {
  const read = new Set(uniqueReadingIds(readIds))
  const sets = readingCollectionSets(pages, readIds)
    .filter((set) => !set.complete)
    .sort((left, right) => {
      if (right.percent !== left.percent) return right.percent - left.percent
      return left.category.localeCompare(right.category, 'ko')
    })

  const categoryPriority = new Map(
    sets.map((set, index) => [set.category, index])
  )

  return pages
    .filter((page) => !read.has(normalizeId(page.pageId)))
    .sort((left, right) => {
      const a = categoryPriority.get(left.category || '기타') ?? 99
      const b = categoryPriority.get(right.category || '기타') ?? 99
      if (a !== b) return a - b
      return left.title.localeCompare(right.title, 'ko')
    })
    .slice(0, limit)
}

const QUIZ_STOPWORDS = new Set([
  '그리고',
  '하지만',
  '때문에',
  '입니다',
  '있습니다',
  '합니다',
  '하는',
  '있는',
  '없는',
  '경우',
  '대한',
  '위한',
  '통해',
  '사용',
  '확인',
  '서버',
  '가이드',
  '내용',
  '기준',
  '관련',
  '현재',
  '해당',
  '진행',
  '가능',
  '합니다'
])

const FALLBACK_DECOYS = [
  '장비강화',
  '신용등급',
  '즉석복권',
  '경마장',
  '카지노',
  '도감',
  '파쿠르',
  '요리',
  '낚시',
  '채광',
  '서버규칙',
  '땅 구매'
]

export type ReadingQuiz = {
  prompt: string
  answer: string
  options: string[]
}

export function buildReadingQuiz(
  page: ReadingGamePage,
  allPages: ReadingGamePage[] = []
): ReadingQuiz | null {
  const text = (page.searchText || '')
    .replace(page.title, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = text.match(/[가-힣A-Za-z0-9]{2,}/g) || []
  const counts = new Map<string, number>()

  for (const raw of tokens) {
    const token = raw.trim()
    if (
      token.length < 3 ||
      token.length > 14 ||
      QUIZ_STOPWORDS.has(token) ||
      /^\d+$/.test(token)
    ) {
      continue
    }
    counts.set(token, (counts.get(token) || 0) + 1)
  }

  const ranked = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1]
    if (right[0].length !== left[0].length) {
      return right[0].length - left[0].length
    }
    return left[0].localeCompare(right[0], 'ko')
  })

  const answer = ranked[0]?.[0]
  if (!answer) return null

  const lowerText = text.toLowerCase()
  const decoys = [
    ...allPages.map((candidate) => candidate.title),
    ...FALLBACK_DECOYS
  ]
    .filter(
      (candidate) =>
        candidate !== page.title &&
        candidate !== answer &&
        !lowerText.includes(candidate.toLowerCase())
    )
    .filter(
      (candidate, index, values) =>
        values.findIndex((value) => value === candidate) === index
    )
    .slice(0, 2)

  if (decoys.length < 2) return null

  const options = [answer, ...decoys].sort(
    (left, right) =>
      stableHash(page.pageId + ':' + left) -
      stableHash(page.pageId + ':' + right)
  )

  return {
    prompt: '이 문서 본문에 실제로 등장한 키워드는 무엇일까요?',
    answer,
    options
  }
}

export function relatedReadingOrder(
  related: ReadingGamePage[],
  fallback: ReadingGamePage[],
  readIds: string[],
  limit = 3
) {
  const read = new Set(uniqueReadingIds(readIds))
  const merged = [...related, ...fallback].filter(
    (page, index, values) =>
      values.findIndex(
        (candidate) => normalizeId(candidate.pageId) === normalizeId(page.pageId)
      ) === index
  )

  return merged
    .sort((left, right) => {
      const leftRead = read.has(normalizeId(left.pageId))
      const rightRead = read.has(normalizeId(right.pageId))
      if (leftRead !== rightRead) return leftRead ? 1 : -1
      return 0
    })
    .slice(0, limit)
}
