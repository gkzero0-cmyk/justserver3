import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile('app/api/version/route.ts', 'utf8')

test('version route declares deployment identity fallbacks', () => {
  assert.match(source, /process\.env\.VERCEL_GIT_COMMIT_SHA/)
  assert.match(source, /process\.env\.GITHUB_SHA/)
  assert.match(source, /process\.env\.VERCEL_ENV/)
  assert.match(source, /'unknown'/)
})

test('version route explicitly disables response caching', () => {
  assert.match(source, /['"]Cache-Control['"]\s*:\s*['"]no-store, max-age=0['"]/)
  assert.match(source, /export const dynamic\s*=\s*['"]force-dynamic['"]/)
})
