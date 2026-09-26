import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sitemap = await readFile('app/sitemap.ts', 'utf8')
const robots = await readFile('app/robots.ts', 'utf8')

test('sitemap keeps drafts out and uses canonical guide paths', () => {
  assert.match(sitemap, /!isDraftPage\(page\)/)
  assert.match(sitemap, /wikiGuidePath\(page\)/)
  assert.match(sitemap, /page\.pageId === index\.rootPageId/)
  assert.match(sitemap, /changeFrequency/)
  assert.match(sitemap, /priority/)
})

test('robots allows public crawling and points to sitemap.xml', () => {
  assert.match(robots, /userAgent:\s*['"]\*['"]/)
  assert.match(robots, /allow:\s*['"]\/['"]/)
  assert.match(robots, /sitemap:\s*\`\$\{siteUrl\}\/sitemap\.xml\`/)
})
