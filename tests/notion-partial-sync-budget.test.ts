import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const cache = fs.readFileSync(new URL('../scripts/cache-notion-assets.mjs', import.meta.url), 'utf8')
const workflow = fs.readFileSync(new URL('../.github/workflows/sync-notion-assets.yml', import.meta.url), 'utf8')
const webhook = fs.readFileSync(new URL('../app/api/notion-webhook/route.ts', import.meta.url), 'utf8')

test('Notion webhook uses changed-page partial sync with full fallback intact', () => {
  assert.match(cache, /NOTION_CHANGED_PAGE_ID/)
  assert.match(cache, /PARTIAL_SYNC/)
  assert.match(cache, /pageLimit = PARTIAL_SYNC \? Math\.min\(16, MAX_PAGES\) : MAX_PAGES/)
  assert.match(cache, /const manifest = PARTIAL_SYNC \? \{ \.\.\.existingManifest \} : \{\}/)
  assert.match(cache, /if \(!PARTIAL_SYNC\) await removeStaleFiles/)
  assert.match(workflow, /page_id:/)
  assert.match(workflow, /NOTION_CHANGED_PAGE_ID:/)
  assert.match(webhook, /triggerAssetSync\(pageId\)/)
  assert.match(webhook, /inputs: pageId \? \{ page_id: pageId \} : \{\}/)
})
