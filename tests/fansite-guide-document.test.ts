import assert from 'node:assert/strict'
import test from 'node:test'

import { extractFansiteGuideDocument } from '../lib/fansite-guide-document.ts'

test('extracts official wiki blocks in document order and resolves cached images', () => {
  const pageId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const imageId = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const recordMap = {
    block: {
      [pageId]: { value: { value: { id: pageId, type: 'page', properties: { title: [['API']] }, content: ['h1', 'p1', 'img1'] } } },
      h1: { value: { value: { id: 'h1', type: 'header', properties: { title: [['API 연동']] } } } },
      p1: { value: { value: { id: 'p1', type: 'text', properties: { title: [['아이디를 입력해 연동합니다.']] } } } },
      img1: { value: { value: { id: 'img1', type: 'image', properties: { source: [[`attachment:${imageId}:api.png`]], caption: [['API 연동 화면']] } } } }
    }
  }
  const manifest = {
    [`https://prod-files-secure.s3.us-west-2.amazonaws.com/workspace/${imageId}/api.png`]: '/notion-assets/api.png'
  }

  const doc = extractFansiteGuideDocument(recordMap, pageId, manifest)
  assert.equal(doc.title, 'API')
  assert.deepEqual(doc.blocks.map((block) => block.type), ['heading', 'text', 'image'])
  assert.equal(doc.blocks[0].text, 'API 연동')
  assert.equal(doc.blocks[1].text, '아이디를 입력해 연동합니다.')
  assert.equal(doc.blocks[2].caption, 'API 연동 화면')
  assert.match(String(doc.blocks[2].src), /cdn\.jsdelivr\.net\/gh\/gkzero0-cmyk\/justserver3@main\/public\/notion-assets\/api\.png$/)
})

test('ignores nested child pages so the fansite mirrors one official document at a time', () => {
  const pageId = 'cccccccccccccccccccccccccccccccc'
  const recordMap = {
    block: {
      [pageId]: { value: { value: { id: pageId, type: 'page', properties: { title: [['스토리']] }, content: ['text1', 'child'] } } },
      text1: { value: { value: { id: 'text1', type: 'text', properties: { title: [['본문']] } } } },
      child: { value: { value: { id: 'child', type: 'page', properties: { title: [['서버규칙']] }, content: ['childText'] } } },
      childText: { value: { value: { id: 'childText', type: 'text', properties: { title: [['다른 문서 내용']] } } } }
    }
  }

  const doc = extractFansiteGuideDocument(recordMap, pageId, {})
  assert.deepEqual(doc.blocks.map((block) => block.text), ['본문'])
})
