import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EMPTY_WIKI_FUN_STATS,
  highestScoreKey,
  normalizeWikiFunStats,
  seoulDateKey,
  unlockedWikiAchievementIds,
  wikiExplorationProgress,
  wikiTitleFromAchievements
} from '../lib/wiki-fun.ts'
import {
  collectionProgress,
  dailyMissionIds,
  dailyMissionProgress,
  normalizeSurvivalRecord,
  recordSurvivalActivity,
  recordSurvivalDay,
  seoulWeekKey,
  survivalVisitStreak,
  treasurePageIds,
  weeklyActivitySummary,
  weeklyChallengeIds,
  weeklyChallengeProgress
} from '../lib/wiki-survival.ts'
import {
  buildReadingQuiz,
  dailyExplorationQuest,
  readingCollectionSets,
  relatedReadingOrder,
  unreadRecommendations
} from '../lib/wiki-reading-game.ts'
import {
  buildStoryChapters,
  nextAdventureAction,
  passportProgress,
  recommendedSurvivalBuild,
  storyProgress,
  weeklyWikiBoss
} from '../lib/wiki-adventure.ts'
import {
  classifyWikiContent,
  extractKoreanInitials,
  matchesKoreanInitials,
  relativeUpdateLabel,
  suggestFallbackPages,
  updateRecentPageIds,
  wikiHeadingId,
  buildWikiFeedbackUrl
} from '../lib/wiki-ux.ts'

test('classifies placeholder and tiny pages as draft', () => {
  assert.equal(
    classifyWikiContent({ searchText: '위키 업데이트 예정입니다.' }),
    'draft'
  )
  assert.equal(classifyWikiContent({ searchText: '짧은 안내' }), 'draft')
})

test('classifies short usable pages as brief and substantial pages as detailed', () => {
  assert.equal(
    classifyWikiContent({ searchText: '가'.repeat(96) }),
    'brief'
  )
  assert.equal(
    classifyWikiContent({ searchText: '가'.repeat(243) }),
    'detailed'
  )
})

test('extracts and matches Korean initial consonants', () => {
  assert.equal(extractKoreanInitials('장비강화'), 'ㅈㅂㄱㅎ')
  assert.equal(extractKoreanInitials('채광'), 'ㅊㄱ')
  assert.equal(matchesKoreanInitials('장비강화', 'ㅈㅂㄱㅎ'), true)
  assert.equal(matchesKoreanInitials('채광', 'ㅈㅂㄱㅎ'), false)
})

test('keeps recent page ids unique, newest first, and capped', () => {
  assert.deepEqual(updateRecentPageIds(['a', 'b', 'c'], 'a', 5), ['a', 'b', 'c'])
  assert.deepEqual(
    updateRecentPageIds(['a', 'b', 'c', 'd', 'e'], 'f', 5),
    ['f', 'a', 'b', 'c', 'd']
  )
})

test('formats recent update dates relative to a supplied now', () => {
  const now = new Date('2026-09-25T12:00:00+09:00')
  assert.equal(relativeUpdateLabel('2026-09-25T01:00:00+09:00', now), '오늘')
  assert.equal(relativeUpdateLabel('2026-09-24T09:00:00+09:00', now), '어제')
  assert.equal(relativeUpdateLabel('2026-09-22T09:00:00+09:00', now), '3일 전')
})


test('suggests ready core guides when search has no direct result', () => {
  const pages = [
    { pageId: 'draft', title: '장비강화', searchText: '위키 업데이트 예정입니다.' },
    { pageId: 'mining', title: '채광', searchText: '가'.repeat(120) },
    { pageId: 'rules', title: '서버규칙', searchText: '가'.repeat(300) },
    { pageId: 'api', title: 'API', searchText: '가'.repeat(300) },
    { pageId: 'story', title: '스토리', searchText: '가'.repeat(300) }
  ]

  assert.deepEqual(
    suggestFallbackPages(
      pages,
      ['서버규칙', '기초설정(뉴비필독)', '채광', '스토리', 'API'],
      3
    ).map((page) => page.pageId),
    ['rules', 'mining', 'story']
  )
})


test('creates stable readable heading ids including duplicate suffixes', () => {
  assert.equal(wikiHeadingId('장비 강화 & 재료'), '장비-강화-재료')
  assert.equal(wikiHeadingId('장비 강화 & 재료', 2), '장비-강화-재료-2')
  assert.equal(wikiHeadingId('  API / 후원 연동  '), 'api-후원-연동')
  assert.equal(wikiHeadingId('!!!'), 'section')
})

test('uses server-provided content status when search text is unavailable', () => {
  const pages = [
    { pageId: 'draft', title: '장비강화', status: 'draft' as const },
    { pageId: 'rules', title: '서버규칙', status: 'detailed' as const },
    { pageId: 'mining', title: '채광', status: 'brief' as const }
  ]

  assert.deepEqual(
    suggestFallbackPages(pages, ['장비강화', '서버규칙', '채광'], 3).map(
      (page) => page.pageId
    ),
    ['rules', 'mining']
  )
})


test('builds a prefilled feedback URL without leaking arbitrary user text', () => {
  const url = new URL(
    buildWikiFeedbackUrl({
      pageId: 'abc123',
      title: '서버규칙',
      kind: 'incorrect'
    })
  )

  assert.equal(url.origin, 'https://github.com')
  assert.equal(url.pathname, '/gkzero0-cmyk/justserver3/issues/new')
  assert.match(url.searchParams.get('title') || '', /서버규칙/)
  assert.match(url.searchParams.get('body') || '', /abc123/)
  assert.match(url.searchParams.get('body') || '', /잘못된 정보/)
})


test('uses the Seoul calendar day for daily fun features', () => {
  assert.equal(
    seoulDateKey(new Date('2026-09-24T15:01:00Z')),
    '2026-09-25'
  )
})

test('calculates exploration only from currently available guides', () => {
  assert.deepEqual(
    wikiExplorationProgress(
      ['aa-bb', 'cc', 'unknown', 'cc'],
      ['aabb', 'cc', 'dd']
    ),
    {
      count: 2,
      total: 3,
      percent: 67,
      visited: ['aabb', 'cc']
    }
  )
})

test('keeps survival type tie results stable', () => {
  assert.equal(
    highestScoreKey(
      {
        miner: 2,
        merchant: 2,
        explorer: 1
      },
      'miner'
    ),
    'miner'
  )
})


test('normalizes persisted play zone stats safely', () => {
  assert.deepEqual(
    normalizeWikiFunStats({
      fortuneDraws: 2.9,
      quizCompletions: -4,
      randomRolls: 'bad',
      eggs: ['play-zone', 'play-zone', 3, 'fortune-orb']
    }),
    {
      fortuneDraws: 2,
      quizCompletions: 0,
      randomRolls: 0,
      eggs: ['play-zone', 'fortune-orb'],
      lastQuizResult: null
    }
  )
  assert.deepEqual(normalizeWikiFunStats(null), EMPTY_WIKI_FUN_STATS)
})

test('unlocks play zone achievements from exploration and activity', () => {
  assert.deepEqual(
    unlockedWikiAchievementIds(
      { count: 3, total: 6, percent: 50 },
      {
        fortuneDraws: 1,
        quizCompletions: 1,
        randomRolls: 3,
        eggs: ['play-zone'],
        lastQuizResult: 'miner'
      }
    ),
    [
      'first-step',
      'guide',
      'explorer',
      'fortune',
      'analyst',
      'randomizer',
      'secret-hunter'
    ]
  )
})

test('chooses the strongest unlocked wiki title deterministically', () => {
  assert.equal(
    wikiTitleFromAchievements(['first-step', 'guide', 'explorer']),
    '적자생존 탐험가'
  )
  assert.equal(
    wikiTitleFromAchievements(['egg-master', 'conqueror']),
    '위키 정복자'
  )
  assert.equal(wikiTitleFromAchievements([]), '신입 생존자')
})


test('records survival days and daily activity without duplicate visits', () => {
  const day = '2026-09-25'
  const started = recordSurvivalDay(normalizeSurvivalRecord(null), day)
  const visited = recordSurvivalActivity(started, day, 'visit', 'aa-bb')
  const visitedAgain = recordSurvivalActivity(visited, day, 'visit', 'aabb')
  const rolled = recordSurvivalActivity(visitedAgain, day, 'random')

  assert.deepEqual(rolled.visitDays, [day])
  assert.deepEqual(rolled.activityByDay[day].visits, ['aabb'])
  const read = recordSurvivalActivity(rolled, day, 'read', 'cc-dd')
  const quiz = recordSurvivalActivity(read, day, 'reading-quiz', 'cc-dd')
  assert.deepEqual(quiz.activityByDay[day].reads, ['ccdd'])
  assert.deepEqual(quiz.activityByDay[day].readingQuizzes, ['ccdd'])
  assert.equal(quiz.activityByDay[day].random, 1)
})

test('calculates consecutive Seoul visit streaks', () => {
  assert.equal(
    survivalVisitStreak(
      ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'],
      '2026-09-25'
    ),
    4
  )
  assert.equal(
    survivalVisitStreak(
      ['2026-09-22', '2026-09-24', '2026-09-25'],
      '2026-09-25'
    ),
    2
  )
})

test('daily missions are stable and report progress', () => {
  const ids = dailyMissionIds('2026-09-25')
  assert.equal(ids.length, 3)
  assert.equal(new Set(ids).size, 3)
  assert.equal(ids[0], 'visit-one')

  const progress = dailyMissionProgress('visit-two', {
    visits: ['opened-only'],
    reads: ['a', 'b'],
    readingQuizzes: [],
    fortune: 0,
    quiz: 0,
    random: 0,
    treasures: []
  })
  assert.deepEqual(progress, { current: 2, target: 2 })
})

test('weekly challenges use Seoul Monday and aggregate seven days', () => {
  assert.equal(
    seoulWeekKey(new Date('2026-09-25T12:00:00+09:00')),
    '2026-09-21'
  )

  let record = normalizeSurvivalRecord(null)
  record = recordSurvivalActivity(record, '2026-09-21', 'visit', 'a')
  record = recordSurvivalActivity(record, '2026-09-22', 'visit', 'b')
  record = recordSurvivalActivity(record, '2026-09-23', 'fortune')
  record = recordSurvivalActivity(record, '2026-09-24', 'fortune')
  record = recordSurvivalActivity(record, '2026-09-25', 'fortune')

  const summary = weeklyActivitySummary(record, '2026-09-21')
  assert.deepEqual(summary.visits, ['a', 'b'])
  assert.equal(summary.fortune, 3)
  assert.equal(
    weeklyChallengeProgress('week-fortune-three', summary).current,
    3
  )
  assert.equal(weeklyChallengeIds('2026-09-21').length, 3)
})

test('treasure targets and collection progress stay deterministic', () => {
  const targets = treasurePageIds(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    4
  )
  assert.equal(targets.length, 4)
  assert.deepEqual(
    targets,
    treasurePageIds(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 4)
  )

  assert.deepEqual(
    collectionProgress(
      [
        { pageId: 'a', category: '시작하기' },
        { pageId: 'b', category: '시작하기' },
        { pageId: 'c', category: '성장 · 경제' }
      ],
      ['a', 'c']
    ),
    [
      { category: '시작하기', count: 1, total: 2, percent: 50 },
      { category: '성장 · 경제', count: 1, total: 1, percent: 100 }
    ]
  )
})


test('reading collection sets award completion only from completed reads', () => {
  const pages = [
    { pageId: 'rules', title: '서버규칙', category: '시작하기' },
    { pageId: 'newbie', title: '기초설정', category: '시작하기' },
    { pageId: 'mine', title: '채광', category: '주요 콘텐츠' }
  ]

  assert.deepEqual(
    readingCollectionSets(pages, ['rules', 'newbie']).map((set) => ({
      title: set.title,
      count: set.count,
      total: set.total,
      complete: set.complete
    })),
    [
      {
        title: '초보 생존 세트',
        count: 2,
        total: 2,
        complete: true
      },
      {
        title: '콘텐츠 탐험 세트',
        count: 0,
        total: 1,
        complete: false
      }
    ]
  )
})

test('daily exploration quest is stable for the same Seoul date', () => {
  const pages = [
    { pageId: 'a', title: '서버규칙', category: '시작하기' },
    { pageId: 'b', title: '기초설정', category: '시작하기' },
    { pageId: 'c', title: '채광', category: '주요 콘텐츠' },
    { pageId: 'd', title: '낚시', category: '주요 콘텐츠' },
    { pageId: 'e', title: '요리', category: '주요 콘텐츠' }
  ]

  const first = dailyExplorationQuest(pages, '2026-09-25')
  const second = dailyExplorationQuest(pages, '2026-09-25')
  assert.equal(first.id, second.id)
  assert.deepEqual(
    first.pages.map((page) => page.pageId),
    second.pages.map((page) => page.pageId)
  )
  assert.ok(first.pages.length >= 1)
  assert.ok(first.pages.length <= 3)
})

test('unread recommendations prioritize nearly completed collections', () => {
  const pages = [
    { pageId: 'a', title: '서버규칙', category: '시작하기' },
    { pageId: 'b', title: '기초설정', category: '시작하기' },
    { pageId: 'c', title: '채광', category: '주요 콘텐츠' },
    { pageId: 'd', title: '낚시', category: '주요 콘텐츠' },
    { pageId: 'e', title: '요리', category: '주요 콘텐츠' }
  ]

  assert.deepEqual(
    unreadRecommendations(pages, ['a'], 2).map((page) => page.pageId),
    ['b', 'd']
  )
})

test('reading quiz answer always comes from the actual page text', () => {
  const page = {
    pageId: 'mine',
    title: '채광',
    category: '주요 콘텐츠',
    searchText:
      '채굴 도구를 준비한 뒤 광산에서 다이아몬드와 광물을 획득할 수 있습니다. 다이아몬드는 중요한 자원입니다.'
  }
  const quiz = buildReadingQuiz(page, [
    page,
    { pageId: 'casino', title: '카지노', category: '주요 콘텐츠' },
    { pageId: 'credit', title: '신용등급', category: '성장 · 경제' }
  ])

  assert.ok(quiz)
  assert.ok(page.searchText.includes(quiz!.answer))
  assert.equal(quiz!.options.length, 3)
  assert.ok(quiz!.options.includes(quiz!.answer))
})

test('related reading order places unread guides before completed ones', () => {
  const related = [
    { pageId: 'a', title: '장비수리', category: '성장 · 경제' },
    { pageId: 'b', title: '장비강화', category: '성장 · 경제' }
  ]
  const fallback = [
    { pageId: 'c', title: '신용등급', category: '성장 · 경제' }
  ]

  assert.deepEqual(
    relatedReadingOrder(related, fallback, ['a'], 3).map(
      (page) => page.pageId
    ),
    ['b', 'c', 'a']
  )
})


test('story mode unlocks chapters sequentially from completed reading', () => {
  const pages = [
    { pageId: 'story', title: '스토리', category: '시작하기' },
    { pageId: 'rules', title: '서버규칙', category: '시작하기' },
    { pageId: 'mine', title: '채광', category: '주요 콘텐츠' },
    { pageId: 'fish', title: '낚시', category: '주요 콘텐츠' },
    { pageId: 'land', title: '땅 구매', category: '성장 · 경제' },
    { pageId: 'credit', title: '신용등급', category: '성장 · 경제' },
    { pageId: 'cook', title: '요리', category: '주요 콘텐츠' },
    { pageId: 'hunt', title: '사냥', category: '주요 콘텐츠' }
  ]
  const chapters = buildStoryChapters(pages)
  const initial = storyProgress(chapters, [])
  assert.equal(initial[0].unlocked, true)
  assert.equal(initial[1].unlocked, false)

  const firstTarget = chapters[0].choices[0].pageId
  const next = storyProgress(chapters, [firstTarget])
  assert.equal(next[0].complete, true)
  assert.equal(next[1].unlocked, true)
})

test('survival build follows personality result and only uses available pages', () => {
  const pages = [
    { pageId: 'mine', title: '채광', category: '주요 콘텐츠' },
    { pageId: 'repair', title: '장비수리', category: '성장 · 경제' },
    { pageId: 'rules', title: '서버규칙', category: '시작하기' }
  ]
  const build = recommendedSurvivalBuild(pages, 'miner', 3)

  assert.equal(build.personalized, true)
  assert.equal(build.title, '광부 생존 빌드')
  assert.deepEqual(
    build.pages.map((page) => page.pageId),
    ['mine', 'repair', 'rules']
  )
})

test('passport awards a special seal only when a category is fully read', () => {
  const pages = [
    { pageId: 'a', title: '서버규칙', category: '시작하기' },
    { pageId: 'b', title: '기초설정(뉴비필독)', category: '시작하기' },
    { pageId: 'c', title: '채광', category: '주요 콘텐츠' }
  ]
  const passport = passportProgress(pages, ['a', 'b'])
  const start = passport.find((group) => group.category === '시작하기')
  const content = passport.find((group) => group.category === '주요 콘텐츠')

  assert.equal(start?.complete, true)
  assert.equal(start?.count, 2)
  assert.equal(content?.complete, false)
  assert.equal(content?.count, 0)
})

test('weekly boss counts rereads on different days as separate reading actions', () => {
  const boss = weeklyWikiBoss(
    {
      '2026-09-21': {
        reads: ['same-page'],
        readingQuizzes: [],
        treasures: []
      },
      '2026-09-22': {
        reads: ['same-page'],
        readingQuizzes: ['same-page'],
        treasures: []
      },
      '2026-09-23': {
        reads: ['another-page'],
        readingQuizzes: [],
        treasures: ['another-page']
      }
    },
    '2026-09-21'
  )

  assert.equal(boss.actions.reads, 3)
  assert.equal(boss.actions.quizzes, 1)
  assert.equal(boss.actions.treasures, 1)
  assert.equal(boss.damage, 56)
  assert.equal(boss.remaining, 44)
})

test('weekly boss caps damage at full defeat', () => {
  const boss = weeklyWikiBoss(
    {
      '2026-09-21': {
        reads: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
        readingQuizzes: ['a'],
        treasures: ['a']
      }
    },
    '2026-09-21'
  )

  assert.equal(boss.damage, 100)
  assert.equal(boss.remaining, 0)
  assert.equal(boss.defeated, true)
})


test('next adventure action prioritizes the active story chapter', () => {
  const pages = [
    { pageId: 'story', title: '스토리', category: '시작하기' },
    { pageId: 'rules', title: '서버규칙', category: '시작하기' },
    { pageId: 'mine', title: '채광', category: '주요 콘텐츠' },
    { pageId: 'fish', title: '낚시', category: '주요 콘텐츠' },
    { pageId: 'credit', title: '신용등급', category: '성장 · 경제' },
    { pageId: 'land', title: '땅 구매', category: '성장 · 경제' }
  ]
  const chapters = buildStoryChapters(pages)
  const story = storyProgress(chapters, [])
  const action = nextAdventureAction(
    story,
    [{ pageId: 'mine', title: '채광', category: '주요 콘텐츠' }],
    [],
    pages
  )

  assert.equal(action?.kind, 'story')
  assert.equal(action?.page.pageId, chapters[0].choices[0].pageId)
})

test('next adventure action falls back to build and reread goals', () => {
  const pages = [
    { pageId: 'a', title: '채광', category: '주요 콘텐츠' },
    { pageId: 'b', title: '도감', category: '성장 · 경제' }
  ]

  const buildAction = nextAdventureAction(
    [],
    pages,
    ['a'],
    pages
  )
  assert.equal(buildAction?.kind, 'build')
  assert.equal(buildAction?.page.pageId, 'b')

  const rereadAction = nextAdventureAction(
    [],
    pages,
    ['a', 'b'],
    pages
  )
  assert.equal(rereadAction?.kind, 'reread')
  assert.equal(rereadAction?.page.pageId, 'a')
})
