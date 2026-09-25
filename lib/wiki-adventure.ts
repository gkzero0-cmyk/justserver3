export type AdventurePage = {
  pageId: string
  title: string
  category?: string | null
}

export type StoryChapter = {
  id: string
  icon: string
  title: string
  description: string
  choices: AdventurePage[]
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

function pickPages(
  pages: AdventurePage[],
  preferredTitles: string[],
  category: string | null,
  used: Set<string>,
  count = 2
) {
  const byTitle = new Map(pages.map((page) => [page.title, page]))
  const selected: AdventurePage[] = []

  const push = (page?: AdventurePage) => {
    if (!page) return
    const id = normalizeId(page.pageId)
    if (!id || used.has(id) || selected.some((item) => normalizeId(item.pageId) === id)) {
      return
    }
    selected.push(page)
  }

  for (const title of preferredTitles) push(byTitle.get(title))

  if (selected.length < count && category) {
    for (const page of pages) {
      if ((page.category || '기타') === category) push(page)
      if (selected.length >= count) break
    }
  }

  if (selected.length < count) {
    for (const page of pages) {
      push(page)
      if (selected.length >= count) break
    }
  }

  for (const page of selected) used.add(normalizeId(page.pageId))
  return selected.slice(0, count)
}

export function buildStoryChapters(
  pages: AdventurePage[]
): StoryChapter[] {
  const used = new Set<string>()
  const specs = [
    {
      id: 'arrival',
      icon: '✉️',
      title: 'CHAPTER 1 · 사자시에 도착하다',
      description:
        '다시 시작된 적자생존. 먼저 이곳의 규칙과 생존 방법을 확인해야 합니다.',
      category: '시작하기',
      titles: ['스토리', '서버규칙', '기초설정(뉴비필독)']
    },
    {
      id: 'income',
      icon: '⛏️',
      title: 'CHAPTER 2 · 첫 벌이를 만들다',
      description:
        '살아남으려면 수입원이 필요합니다. 어떤 방식으로 첫 자금을 마련할까요?',
      category: '주요 콘텐츠',
      titles: ['채광', '낚시', '사냥', '도축', '요리']
    },
    {
      id: 'growth',
      icon: '⚒️',
      title: 'CHAPTER 3 · 생존 기반을 만들다',
      description:
        '벌기만 해서는 부족합니다. 장비와 성장 루트를 정비할 차례입니다.',
      category: '성장 · 경제',
      titles: ['장비수리', '장비강화', '도감', '땅 구매']
    },
    {
      id: 'escape',
      icon: '💸',
      title: 'CHAPTER 4 · 적자 탈출 작전',
      description:
        '마지막 목표는 적자를 벗어나는 것. 경제 시스템을 이해하고 탈출 루트를 완성하세요.',
      category: '성장 · 경제',
      titles: ['빚 갚기', '신용등급', '즉석복권', '경마장', '카지노']
    }
  ]

  return specs
    .map((spec) => ({
      id: spec.id,
      icon: spec.icon,
      title: spec.title,
      description: spec.description,
      choices: pickPages(
        pages,
        spec.titles,
        spec.category,
        used,
        2
      )
    }))
    .filter((chapter) => chapter.choices.length > 0)
}

export function storyProgress(
  chapters: StoryChapter[],
  readIds: string[]
) {
  const read = new Set(readIds.map(normalizeId))
  let unlocked = true

  return chapters.map((chapter) => {
    const completedChoice = chapter.choices.find((page) =>
      read.has(normalizeId(page.pageId))
    )
    const complete = unlocked && Boolean(completedChoice)
    const state = {
      ...chapter,
      unlocked,
      complete,
      completedPageId: complete ? completedChoice?.pageId || null : null
    }

    if (!complete) unlocked = false
    return state
  })
}

type BuildDefinition = {
  icon: string
  title: string
  description: string
  preferred: string[]
}

const BUILD_DEFINITIONS: Record<string, BuildDefinition> = {
  miner: {
    icon: '⛏️',
    title: '광부 생존 빌드',
    description: '꾸준한 채광과 장비 성장으로 안정적인 기반을 만드는 루트입니다.',
    preferred: ['채광', '장비수리', '장비강화', '도감', '신용등급']
  },
  merchant: {
    icon: '💰',
    title: '경제 설계 빌드',
    description: '수입과 지출 구조를 이해하고 자산을 늘리는 루트입니다.',
    preferred: ['빚 갚기', '신용등급', '땅 구매', '채광', '요리']
  },
  gambler: {
    icon: '🎲',
    title: '한방 승부 빌드',
    description: '확률형 콘텐츠를 살펴보되 경제 기반도 함께 챙기는 루트입니다.',
    preferred: ['즉석복권', '경마장', '카지노', '신용등급', '채광']
  },
  explorer: {
    icon: '🧭',
    title: '콘텐츠 탐험 빌드',
    description: '여러 콘텐츠를 넓게 경험하며 도감을 채우는 루트입니다.',
    preferred: ['스토리', '낚시', '사냥', '파쿠르', '도감']
  },
  strategist: {
    icon: '🗺️',
    title: '계획형 생존 빌드',
    description: '규칙과 성장 구조부터 파악한 뒤 효율적으로 움직이는 루트입니다.',
    preferred: ['서버규칙', '기초설정(뉴비필독)', '신용등급', '장비강화', '채광']
  },
  collector: {
    icon: '📚',
    title: '수집가 완성 빌드',
    description: '다양한 콘텐츠를 경험하고 기록을 채우는 루트입니다.',
    preferred: ['도감', '낚시', '사냥', '요리', '채광']
  },
  default: {
    icon: '🧭',
    title: '기본 생존 빌드',
    description: '생존형 테스트 전이라면 가장 기본적인 순서로 시작합니다.',
    preferred: ['서버규칙', '기초설정(뉴비필독)', '채광', '도감', '신용등급']
  }
}

export function recommendedSurvivalBuild(
  pages: AdventurePage[],
  quizResult: string | null,
  limit = 5
) {
  const definition =
    BUILD_DEFINITIONS[quizResult || 'default'] || BUILD_DEFINITIONS.default
  const byTitle = new Map(pages.map((page) => [page.title, page]))
  const selected: AdventurePage[] = []
  const used = new Set<string>()

  const add = (page?: AdventurePage) => {
    if (!page) return
    const id = normalizeId(page.pageId)
    if (!id || used.has(id)) return
    used.add(id)
    selected.push(page)
  }

  for (const title of definition.preferred) {
    add(byTitle.get(title))
    if (selected.length >= limit) break
  }

  if (selected.length < limit) {
    for (const page of pages) {
      add(page)
      if (selected.length >= limit) break
    }
  }

  return {
    ...definition,
    personalized: Boolean(
      quizResult && BUILD_DEFINITIONS[quizResult]
    ),
    pages: selected
  }
}

export function passportProgress(
  pages: AdventurePage[],
  readIds: string[]
) {
  const read = new Set(readIds.map(normalizeId))
  const categories = ['시작하기', '주요 콘텐츠', '성장 · 경제']

  return categories
    .map((category) => {
      const categoryPages = pages.filter(
        (page) => (page.category || '기타') === category
      )
      const completed = categoryPages.filter((page) =>
        read.has(normalizeId(page.pageId))
      )
      return {
        category,
        pages: categoryPages.map((page) => ({
          ...page,
          complete: read.has(normalizeId(page.pageId))
        })),
        count: completed.length,
        total: categoryPages.length,
        complete:
          categoryPages.length > 0 &&
          completed.length === categoryPages.length
      }
    })
    .filter((group) => group.total > 0)
}

function dateKeyDayNumber(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function dayNumberDateKey(dayNumber: number) {
  const date = new Date(dayNumber * 86400000)
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

type BossActivity = {
  reads?: string[]
  readingQuizzes?: string[]
  treasures?: string[]
  fortune?: number
  quiz?: number
  random?: number
}

const BOSSES = [
  { icon: '🪨', name: '적자의 골렘', flavor: '쌓여가는 적자를 몸집으로 삼은 거대한 골렘' },
  { icon: '📦', name: '빚더미 미믹', flavor: '보물상자처럼 보이지만 열수록 빚이 늘어난다' },
  { icon: '🟣', name: '강화 슬라임', flavor: '실패할수록 더 단단해지는 끈질긴 슬라임' },
  { icon: '🏦', name: '사자시 금고지기', flavor: '지식 없이는 절대 금고를 열어주지 않는 수문장' }
]

export function weeklyWikiBoss(
  activityByDay: Record<string, BossActivity>,
  weekKey: string
) {
  const start = dateKeyDayNumber(weekKey)
  let reads = 0
  const quizzes = new Set<string>()
  const treasures = new Set<string>()
  let fortune = 0
  let personalityQuiz = 0
  let random = 0

  for (let offset = 0; offset < 7; offset += 1) {
    const activity = activityByDay[dayNumberDateKey(start + offset)]
    if (!activity) continue

    reads += (activity.reads || []).length
    for (const id of activity.readingQuizzes || []) quizzes.add(normalizeId(id))
    for (const id of activity.treasures || []) treasures.add(normalizeId(id))
    fortune += Math.max(0, Math.floor(activity.fortune || 0))
    personalityQuiz += Math.max(0, Math.floor(activity.quiz || 0))
    random += Math.max(0, Math.floor(activity.random || 0))
  }

  const hp = 100
  const damage = Math.min(
    hp,
    reads * 12 +
      quizzes.size * 8 +
      treasures.size * 12 +
      fortune * 3 +
      personalityQuiz * 6 +
      random * 3
  )
  const boss = BOSSES[stableHash('boss:' + weekKey) % BOSSES.length]

  return {
    ...boss,
    hp,
    damage,
    remaining: Math.max(0, hp - damage),
    percent: Math.min(100, damage),
    defeated: damage >= hp,
    actions: {
      reads,
      quizzes: quizzes.size,
      treasures: treasures.size,
      fortune,
      personalityQuiz,
      random
    }
  }
}


export function nextAdventureAction(
  story: Array<StoryChapter & { unlocked: boolean; complete: boolean }>,
  buildPages: AdventurePage[],
  readIds: string[],
  allPages: AdventurePage[]
) {
  const read = new Set(readIds.map(normalizeId))
  const activeChapter = story.find(
    (chapter) => chapter.unlocked && !chapter.complete
  )

  const storyTarget =
    activeChapter?.choices.find(
      (page) => !read.has(normalizeId(page.pageId))
    ) || activeChapter?.choices[0]

  if (storyTarget) {
    return {
      kind: 'story' as const,
      eyebrow: 'STORY NEXT',
      title: storyTarget.title,
      description: activeChapter?.title || '스토리 모드 이어하기',
      page: storyTarget
    }
  }

  const buildTarget = buildPages.find(
    (page) => !read.has(normalizeId(page.pageId))
  )
  if (buildTarget) {
    return {
      kind: 'build' as const,
      eyebrow: 'BUILD NEXT',
      title: buildTarget.title,
      description: '추천 생존 빌드의 다음 단계',
      page: buildTarget
    }
  }

  const unread = allPages.find(
    (page) => !read.has(normalizeId(page.pageId))
  )
  if (unread) {
    return {
      kind: 'explore' as const,
      eyebrow: 'EXPLORE NEXT',
      title: unread.title,
      description: '아직 완독하지 않은 가이드',
      page: unread
    }
  }

  const reread = allPages[0] || null
  return reread
    ? {
        kind: 'reread' as const,
        eyebrow: 'WEEKLY BOSS',
        title: reread.title,
        description: '다시 읽고 이번 주 보스에게 피해 주기',
        page: reread
      }
    : null
}
