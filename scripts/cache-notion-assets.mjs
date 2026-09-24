import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { NotionAPI } from 'notion-client'

const notion = new NotionAPI()

const ROOT_PAGE_ID = (
  process.env.NOTION_PAGE_ID || '3dad57d6a55c80469f3de9730cb88975'
).replaceAll('-', '')

const SOFT_FAIL = process.argv.includes('--soft-fail')
const MAX_PAGES = Number(process.env.NOTION_ASSET_MAX_PAGES || 250)
const OUT_DIR = path.join(process.cwd(), 'public', 'notion-assets')
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json')
const INDEX_PATH = path.join(OUT_DIR, 'index.json')

function canonicalUrl(value) {
  if (!value || typeof value !== 'string') return null

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function getTextValue(value) {
  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && /^https?:\/\//i.test(item)) return item
      if (Array.isArray(item)) {
        for (const child of item) {
          if (typeof child === 'string' && /^https?:\/\//i.test(child)) {
            return child
          }
        }
      }
    }
  }

  return null
}

function unwrapBlockEntry(entry) {
  return entry?.value?.value ?? entry?.value ?? entry ?? null
}

function blocks(recordMap) {
  return Object.values(recordMap?.block || {})
    .map(unwrapBlockEntry)
    .filter(Boolean)
}

function normalizeId(value) {
  return String(value || '').replaceAll('-', '')
}

function getBlockTitle(block) {
  const title = block?.properties?.title
  if (!Array.isArray(title)) return ''

  return title
    .map((part) => {
      if (!Array.isArray(part)) return ''
      return typeof part[0] === 'string' ? part[0] : ''
    })
    .join('')
    .trim()
}

function getPageMeta(recordMap, pageId) {
  const normalized = normalizeId(pageId)

  const pageBlock =
    blocks(recordMap).find(
      (block) =>
        normalizeId(block?.id) === normalized &&
        (block?.type === 'page' || block?.type === 'collection_view_page')
    ) ||
    blocks(recordMap).find(
      (block) => block?.type === 'page' || block?.type === 'collection_view_page'
    )

  if (!pageBlock) {
    return {
      pageId: normalized,
      title: '제목 없는 페이지',
      parentId: null,
      icon: null,
      cover: null
    }
  }

  return {
    pageId: normalized,
    title: getBlockTitle(pageBlock) || '제목 없는 페이지',
    parentId: pageBlock.parent_id ? normalizeId(pageBlock.parent_id) : null,
    icon: pageBlock.format?.page_icon || null,
    cover: pageBlock.format?.page_cover || null
  }
}

function collectPageIds(recordMap, currentPageId) {
  const ids = new Set()
  const seen = new WeakSet()

  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)

    if (
      (value.type === 'page' || value.type === 'collection_view_page') &&
      value.id
    ) {
      const id = String(value.id).replaceAll('-', '')
      if (id !== currentPageId) ids.add(id)
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }

    for (const item of Object.values(value)) visit(item)
  }

  visit(recordMap)
  return [...ids]
}

function collectAssetUrls(recordMap) {
  const urls = new Set()
  const seen = new WeakSet()

  function visit(value) {
    if (typeof value === 'string') {
      if (/^https?:\/\//i.test(value)) urls.add(value)
      return
    }

    if (!value || typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)

    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }

    for (const item of Object.values(value)) visit(item)
  }

  visit(recordMap)
  return [...urls]
}

function blockTypeSummary(recordMap) {
  const counts = new Map()

  for (const block of blocks(recordMap)) {
    const type = block.type || 'unknown'
    counts.set(type, (counts.get(type) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}:${count}`)
    .join(', ')
}

function extensionForContentType(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase()

  const extensions = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/avif': '.avif',
    'image/bmp': '.bmp',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico'
  }

  return extensions[type] || null
}

function fileHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 32)
}

async function downloadImage(sourceUrl, canonical) {
  const response = await fetch(sourceUrl, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (compatible; justserver3-notion-asset-sync/1.0)'
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type')
  const extension = extensionForContentType(contentType)

  if (!extension) {
    throw new Error(`Not an image: ${contentType || 'unknown content-type'}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  const filename = `${fileHash(canonical)}${extension}`
  const diskPath = path.join(OUT_DIR, filename)

  await fs.writeFile(diskPath, bytes)

  return {
    filename,
    publicPath: `/notion-assets/${filename}`
  }
}

async function crawlPages() {
  const queue = [ROOT_PAGE_ID]
  const visited = new Set()
  const results = []

  while (queue.length && visited.size < MAX_PAGES) {
    const pageId = queue.shift()
    if (!pageId || visited.has(pageId)) continue

    visited.add(pageId)

    try {
      const recordMap = await notion.getPage(pageId)
      results.push({
        pageId,
        recordMap,
        meta: getPageMeta(recordMap, pageId)
      })

      for (const childPageId of collectPageIds(recordMap, pageId)) {
        if (!visited.has(childPageId)) queue.push(childPageId)
      }

      console.log(
        `[notion] page ${visited.size}: ${pageId} (${collectAssetUrls(recordMap).length} URL candidates)`
      )
      console.log(`[notion] block types: ${blockTypeSummary(recordMap)}`)
    } catch (error) {
      console.warn(
        `[notion] failed to load page ${pageId}: ${error?.message || error}`
      )
    }
  }

  return results
}

async function readExistingManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))
  } catch {
    return {}
  }
}

async function removeStaleFiles(activeFilenames) {
  const entries = await fs.readdir(OUT_DIR, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (entry.name === 'manifest.json' || entry.name === 'index.json') continue
    if (activeFilenames.has(entry.name)) continue

    await fs.unlink(path.join(OUT_DIR, entry.name))
    console.log(`[assets] removed stale file ${entry.name}`)
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  const pages = await crawlPages()

  if (!pages.length) {
    throw new Error(
      'The public Notion page could not be read. Check its public sharing setting.'
    )
  }

  const sourceUrls = new Map()

  for (const { recordMap } of pages) {
    for (const url of collectAssetUrls(recordMap)) {
      const key = canonicalUrl(url)
      if (key && !sourceUrls.has(key)) sourceUrls.set(key, url)
    }
  }

  const existingManifest = await readExistingManifest()
  const manifest = {}
  const activeFilenames = new Set()
  let downloaded = 0
  let reused = 0
  let failed = 0

  for (const [key, sourceUrl] of sourceUrls) {
    const existingPublicPath = existingManifest[key]

    if (
      typeof existingPublicPath === 'string' &&
      existingPublicPath.startsWith('/notion-assets/')
    ) {
      const existingFilename = path.basename(existingPublicPath)

      try {
        await fs.access(path.join(OUT_DIR, existingFilename))
        manifest[key] = existingPublicPath
        activeFilenames.add(existingFilename)
        reused += 1
        continue
      } catch {
        // Missing local file: fall through and download it again.
      }
    }

    try {
      const asset = await downloadImage(sourceUrl, key)
      manifest[key] = asset.publicPath
      activeFilenames.add(asset.filename)
      downloaded += 1
      console.log(`[assets] cached ${key} -> ${asset.publicPath}`)
    } catch (error) {
      failed += 1
      console.warn(
        `[assets] skipped ${key}: ${error?.message || error}`
      )
    }
  }

  await fs.writeFile(
    MANIFEST_PATH,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  )

  const pageIndex = pages.map(({ meta }) => ({
    ...meta,
    icon: meta.icon ? manifest[canonicalUrl(meta.icon)] || meta.icon : null,
    cover: meta.cover ? manifest[canonicalUrl(meta.cover)] || meta.cover : null
  }))

  await fs.writeFile(
    INDEX_PATH,
    JSON.stringify(
      {
        rootPageId: ROOT_PAGE_ID,
        generatedAt: new Date().toISOString(),
        pages: pageIndex
      },
      null,
      2
    ) + '\n',
    'utf8'
  )

  await removeStaleFiles(activeFilenames)

  console.log(
    `[assets] complete: ${pages.length} pages, ${downloaded} downloaded, ${reused} reused, ${failed} skipped`
  )
}

main().catch((error) => {
  console.error(`[assets] sync failed: ${error?.stack || error}`)

  if (SOFT_FAIL) {
    console.warn('[assets] soft-fail enabled; continuing build with existing cache')
    process.exit(0)
  }

  process.exit(1)
})
