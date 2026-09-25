import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyWikiContent,
  extractKoreanInitials,
  matchesKoreanInitials,
  relativeUpdateLabel,
  updateRecentPageIds
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
