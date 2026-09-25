import assert from 'node:assert/strict'
import test from 'node:test'

import {
  highestScoreKey,
  seoulDateKey,
  wikiExplorationProgress
} from '../lib/wiki-fun.ts'
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
