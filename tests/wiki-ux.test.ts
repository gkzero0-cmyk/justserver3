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
  assert.equal(rolled.activityByDay[day].random, 1)
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
    visits: ['a', 'b'],
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
