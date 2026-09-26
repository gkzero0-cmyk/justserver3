import { access, readFile, readdir, stat } from 'node:fs/promises'
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

for (const page of notionIndex.pages || []) {
  for (const field of assetFields) {
    const value = page[field]
    if (typeof value === 'string' && value.startsWith('/notion-assets/')) {
      referencedAssets.add(value)
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
  for (const file of optimized) {
    const info = await stat(file)
    if (info.size > 1024 * 1024) oversized.push({ file, size: info.size })
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
