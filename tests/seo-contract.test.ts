import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sitemap = await readFile('app/sitemap.ts', 'utf8')
const robots = await readFile('app/robots.ts', 'utf8')
const nextConfig = await readFile('next.config.ts', 'utf8')

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


test('home sitemap lastmod follows the latest indexable content edit', () => {
  assert.match(sitemap, /latestContentEdit/)
  assert.match(sitemap, /Math\.max\(\.\.\.validEditedTimes\)/)
})

test('public pages cannot be embedded by third-party frames', () => {
  assert.match(nextConfig, /X-Frame-Options/)
  assert.match(nextConfig, /DENY/)
  assert.match(nextConfig, /frame-ancestors 'none'/)
})
