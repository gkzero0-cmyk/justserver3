import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildWikiFeedbackIssue,
  validateWikiFeedbackPayload
} from '../lib/wiki-feedback.ts'

const valid = {
  pageId: '3dad57d6a55c802aa11adaed7c2c98ff',
  title: '서버규칙',
  url: 'https://justserver3.vercel.app/guide/rules/',
  kind: 'incorrect',
  message: '무한용암 관련 내용을 다시 확인해주세요.',
  nickname: 'tester'
}

test('validates a normal site feedback payload', () => {
  const result = validateWikiFeedbackPayload(valid)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.pageId, valid.pageId)
  assert.equal(result.value.kind, 'incorrect')
})

test('rejects external document urls and oversized messages', () => {
  assert.equal(
    validateWikiFeedbackPayload({
      ...valid,
      url: 'https://example.com/guide/rules/'
    }).ok,
    false
  )

  assert.equal(
    validateWikiFeedbackPayload({
      ...valid,
      message: '가'.repeat(1501)
    }).ok,
    false
  )
})

test('feedback issue body neutralizes mentions and keeps canonical url', () => {
  const result = validateWikiFeedbackPayload({
    ...valid,
    message: '@everyone 확인해주세요.'
  })
  assert.equal(result.ok, true)
  if (!result.ok) return

  const issue = buildWikiFeedbackIssue(
    result.value,
    '2026-09-27T12:00:00.000Z'
  )

  assert.match(issue.title, /\[사이트 제보\] 서버규칙/)
  assert.match(issue.body, /https:\/\/justserver3\.vercel\.app\/guide\/rules\//)
  assert.doesNotMatch(issue.body, /@everyone/)
})
