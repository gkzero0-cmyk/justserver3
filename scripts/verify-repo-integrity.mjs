import { access, appendFile, readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

import { WIKI_GUIDE_ROUTES } from '../lib/wiki-routes.ts'

const root = process.cwd()
let failed = false

function fail(message) {
  failed = true
  console.error(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const ids = new Set()
const slugs = new Set()
const titles = new Set()

for (const route of WIKI_GUIDE_ROUTES) {
  if (!/^[0-9a-f]{32}$/i.test(route.pageId)) {
    fail(`invalid page id for ${route.title}: ${route.pageId}`)
  }
  if (!/^[a-z0-9-]+$/.test(route.slug)) {
    fail(`invalid guide slug for ${route.title}: ${route.slug}`)
  }
  if (ids.has(route.pageId)) fail(`duplicate page id: ${route.pageId}`)
  if (slugs.has(route.slug)) fail(`duplicate guide slug: ${route.slug}`)
  if (titles.has(route.title)) fail(`duplicate guide title: ${route.title}`)
  ids.add(route.pageId)
  slugs.add(route.slug)
  titles.add(route.title)
}

if (!failed) pass(`${WIKI_GUIDE_ROUTES.length} guide routes are unique and well formed`)

const notionIndexPath = join(root, 'public/notion-assets/index.json')
const manifestPath = join(root, 'public/notion-assets/manifest.json')
const notionIndex = JSON.parse(await readFile(notionIndexPath, 'utf8'))
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (!/^[0-9a-f]{32}$/i.test(String(notionIndex.rootPageId || '').replaceAll('-', ''))) {
  fail(`invalid Notion rootPageId: ${notionIndex.rootPageId || '(missing)'}`)
}

if (!notionIndex.generatedAt || Number.isNaN(new Date(notionIndex.generatedAt).getTime())) {
  fail(`invalid Notion generatedAt: ${notionIndex.generatedAt || '(missing)'}`)
}

if (!Array.isArray(notionIndex.pages) || notionIndex.pages.length === 0) {
  fail('Notion index has no pages')
}

const notionIds = new Set()
const notionTitles = new Set()
for (const page of notionIndex.pages || []) {
  const normalizedId = String(page.pageId || '').replaceAll('-', '').toLowerCase()
  if (!/^[0-9a-f]{32}$/i.test(normalizedId)) {
    fail(`invalid Notion pageId: ${page.pageId || '(missing)'}`)
  }
  if (!String(page.title || '').trim()) {
    fail(`Notion page ${normalizedId || '(unknown)'} has an empty title`)
  }
  if (notionIds.has(normalizedId)) fail(`duplicate Notion pageId: ${normalizedId}`)
  if (notionTitles.has(page.title)) fail(`duplicate Notion title: ${page.title}`)
  notionIds.add(normalizedId)
  notionTitles.add(page.title)

  if (page.lastEdited && Number.isNaN(new Date(page.lastEdited).getTime())) {
    fail(`invalid lastEdited for ${page.title}: ${page.lastEdited}`)
  }
}

const indexById = new Map(
  (notionIndex.pages || []).map((page) => [
    String(page.pageId || '').replaceAll('-', '').toLowerCase(),
    page
  ])
)

for (const route of WIKI_GUIDE_ROUTES) {
  const page = indexById.get(route.pageId)
  if (!page) {
    fail(`Notion index is missing route ${route.slug} (${route.pageId})`)
    continue
  }
  if (page.title !== route.title) {
    fail(`route title mismatch for ${route.slug}: expected "${route.title}", got "${page.title}"`)
  }
}

if (!failed) pass('guide routes match the cached Notion index')

const referencedAssets = new Set(Object.values(manifest))
const assetFields = [
  'icon',
  'cover',
  'thumbnail',
  'thumbnailSmall',
  'hero',
  'hero768',
  'hero1280',
  'hero1600',
  'logo64',
  'logo128',
  'logo'
]

const unsafeUrlPattern = /^(?:javascript|data|vbscript):/i

for (const page of notionIndex.pages || []) {
  for (const field of assetFields) {
    const value = page[field]
    if (typeof value !== 'string' || !value) continue

    if (unsafeUrlPattern.test(value)) {
      fail(`unsafe asset URL in ${page.title}.${field}: ${value.slice(0, 80)}`)
      continue
    }

    if (value.startsWith('/notion-assets/')) {
      referencedAssets.add(value)
    } else if (!value.startsWith('/') && !/^https:\/\//i.test(value)) {
      fail(`unsupported asset URL in ${page.title}.${field}: ${value.slice(0, 80)}`)
    }
  }
}

for (const [source, target] of Object.entries(manifest)) {
  for (const [kind, value] of [['source', source], ['target', target]]) {
    if (typeof value !== 'string' || !value) {
      fail(`manifest contains empty ${kind} URL`)
      continue
    }
    if (unsafeUrlPattern.test(value)) {
      fail(`manifest contains unsafe ${kind} URL: ${value.slice(0, 80)}`)
    }
  }
}

let missingAssets = 0
for (const publicPath of referencedAssets) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/')) continue
  const filePath = join(root, 'public', publicPath)
  if (!(await exists(filePath))) {
    missingAssets += 1
    fail(`missing referenced asset: ${publicPath}`)
  }
}
if (!missingAssets) pass(`${referencedAssets.size} referenced Notion assets exist`)

const criticalAssets = [
  'public/enhancement-lab/diamond-pickaxe.png',
  'public/enhancement-lab/enchanted-diamond-pickaxe.webp'
]

for (const relativePath of criticalAssets) {
  const filePath = join(root, relativePath)
  if (!(await exists(filePath))) {
    fail(`missing critical asset: ${relativePath}`)
    continue
  }

  const info = await stat(filePath)
  if (info.size <= 0) fail(`empty critical asset: ${relativePath}`)
  if (info.size > 512 * 1024) {
    fail(`critical asset exceeds 512KB budget: ${relativePath} (${info.size} bytes)`)
  }
}
if (!failed) pass('critical enhancement assets are present and within budget')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else files.push(full)
  }
  return files
}

const optimizedDir = join(root, 'public/notion-assets/optimized')
if (await exists(optimizedDir)) {
  const optimized = (await walk(optimizedDir)).filter((path) =>
    /\.(?:webp|avif|png|jpe?g)$/i.test(path)
  )
  const oversized = []
  const measured = []
  for (const file of optimized) {
    const info = await stat(file)
    measured.push({ file, size: info.size })
    if (info.size > 1024 * 1024) oversized.push({ file, size: info.size })
  }

  const totalBytes = measured.reduce((sum, item) => sum + item.size, 0)
  const largest = [...measured].sort((a, b) => b.size - a.size).slice(0, 10)
  console.log(
    `INFO optimized assets: ${optimized.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total`
  )
  for (const item of largest.slice(0, 5)) {
    console.log(
      `INFO large optimized asset: ${item.file.replace(root + '/', '')} ${(item.size / 1024).toFixed(0)} KB`
    )
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## Repository integrity',
      '',
      `- Guide routes: ${WIKI_GUIDE_ROUTES.length}`,
      `- Referenced Notion assets: ${referencedAssets.size}`,
      `- Optimized display assets: ${optimized.length}`,
      `- Optimized asset total: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
      '',
      '### Largest optimized display assets',
      '',
      '| File | Size |',
      '| --- | ---: |',
      ...largest.map(
        (item) =>
          `| ${item.file.replace(root + '/', '')} | ${(item.size / 1024).toFixed(0)} KB |`
      ),
      ''
    ]
    await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'))
  }
  if (oversized.length) {
    for (const item of oversized) {
      fail(`optimized image exceeds 1MB budget: ${item.file.replace(root + '/', '')} (${item.size} bytes)`)
    }
  } else {
    pass(`${optimized.length} optimized images stay within the 1MB display budget`)
  }
}

if (failed) process.exitCode = 1
