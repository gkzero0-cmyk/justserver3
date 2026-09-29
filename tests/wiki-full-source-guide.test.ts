import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const pageSource = fs.readFileSync('app/page/[pageId]/page.tsx', 'utf8')
const shellSource = fs.readFileSync('components/wiki-shell.tsx', 'utf8')
const feedbackSource = fs.readFileSync('components/wiki-document-feedback.tsx', 'utf8')
const notionSource = fs.readFileSync('components/notion-document.tsx', 'utf8')

test('brief guides keep the full Notion source below the verified overview', () => {
  assert.match(pageSource, /hasVerifiedBrief &&/)
  assert.match(pageSource, /source-detail-card/)
  assert.match(pageSource, /<NotionDocument/)
  assert.match(pageSource, /상세 가이드 바로 보기/)
})

test('full source guides use stricter completion thresholds', () => {
  assert.match(shellSource, /hasFullSource \? 80 : 70/)
  assert.match(shellSource, /hasFullSource \? 15/)
  assert.match(shellSource, /readingProgress >= requiredProgress/)
  assert.match(shellSource, /readingProgressRef\.current >= requiredProgress/)
})

test('Notion source images are progressively loaded', () => {
  assert.match(notionSource, /image\.decoding = 'async'/)
  assert.match(notionSource, /image\.loading = 'lazy'/)
  assert.match(notionSource, /fetchpriority/)
})

test('document sharing is a simple canonical link copy action', () => {
  assert.match(feedbackSource, /copyDocumentLink/)
  assert.match(feedbackSource, /navigator\.clipboard\.writeText/)
  assert.match(feedbackSource, /복사 완료/)
  assert.doesNotMatch(feedbackSource, /navigator\.share/)
})
