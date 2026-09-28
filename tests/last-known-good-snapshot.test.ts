import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const script=fs.readFileSync(new URL('../scripts/update-last-known-good.mjs',import.meta.url),'utf8')
const workflow=fs.readFileSync(new URL('../.github/workflows/sync-notion-assets.yml',import.meta.url),'utf8')

test('wiki preserves validated last-known-good manifests',()=>{
  assert.match(script,/index\.json/)
  assert.match(script,/search-index\.json/)
  assert.match(script,/display-manifest\.json/)
  assert.match(script,/manifest\.json/)
  assert.match(script,/throw new Error\('index\.json empty'\)/)
  assert.match(workflow,/Refresh last-known-good manifests/)
  assert.match(workflow,/public\/last-known-good/)
})
