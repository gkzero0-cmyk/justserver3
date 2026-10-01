import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFansiteGuideFeed } from '../lib/fansite-guide-feed.ts'

const OFFICIAL_ORIGIN = 'https://server1.wiki.xn--9i1bk7xhlfi8hzzf.com/'

test('fansite guide feed exposes only official wiki data', () => {
  const feed = buildFansiteGuideFeed({
    rootPageId: 'root',
    generatedAt: '2026-10-01T00:00:00.000Z',
    pages: [
      { pageId: 'story', title: '스토리', parentId: 'root', icon: null, cover: null, lastEdited: null, searchText: '스토리 본문', sections: [{ heading: '시작', anchor: 'start', text: '공식 위키 본문' }] },
      { pageId: 'admin', title: 'ADMIN', parentId: 'root', icon: null, cover: null, lastEdited: null, searchText: '숨김', sections: [{ heading: '비공개', anchor: 'private', text: '노출 금지' }], category: 'ADMIN' } as never
    ]
  })

  assert.equal(feed.source, OFFICIAL_ORIGIN)
  assert.equal(feed.generatedAt, '2026-10-01T00:00:00.000Z')
  assert.equal(feed.pages.length, 1)
  assert.equal(feed.pages[0].title, '스토리')
  assert.equal(feed.pages[0].sections?.[0]?.text, '공식 위키 본문')
  assert.doesNotMatch(JSON.stringify(feed), /justserver3\.vercel\.app|notion\.so|app\.notion\.com/)
})
