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
const SEARCH_INDEX_PATH = path.join(OUT_DIR, 'search-index.json')
const VERIFIED_FAQ_PATH = path.join(
  process.cwd(),
  'data',
  'wiki-verified-faq.json'
)

function sanitizeSearchText(value) {
  return String(value || '')
    .replace(
      /(?:^|\s)(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|\d+|[\w.-]{3,})\.(?:png|jpe?g|webp|gif|svg|avif|bmp)(?=\s|$)/gi,
      ' '
    )
    .replace(/attachment:[^\s]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function readVerifiedFaq() {
  try {
    const parsed = JSON.parse(await fs.readFile(VERIFIED_FAQ_PATH, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function verifiedFaqSearchPayload(entries) {
  const searchText = entries
    .flatMap((entry) => [
      entry.question,
      entry.answer,
      ...(Array.isArray(entry.keywords) ? entry.keywords : [])
    ])
    .filter(Boolean)
    .join(' ')

  return {
    searchText: sanitizeSearchText(searchText),
    sections: entries.map((entry, index) => ({
      heading: entry.question || `FAQ ${index + 1}`,
      anchor: `faq-${index + 1}`,
      text: sanitizeSearchText(
        [entry.answer, ...(Array.isArray(entry.keywords) ? entry.keywords : [])]
          .filter(Boolean)
          .join(' ')
      )
    }))
  }
}

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

function wikiHeadingId(text, occurrence = 1) {
  const base =
    text
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '') || 'section'

  return occurrence > 1 ? `${base}-${occurrence}` : base
}

function collectSearchSections(recordMap, pageBlock) {
  if (!pageBlock) return []

  const byId = new Map(
    blocks(recordMap)
      .filter((block) => block?.id)
      .map((block) => [normalizeId(block.id), block])
  )
  const headingTypes = new Set(['header', 'sub_header', 'sub_sub_header'])
  const occurrences = new Map()
  const sections = []
  let current = { heading: '', anchor: '', text: [] }

  const flush = () => {
    const text = sanitizeSearchText(current.text.join(' ')).slice(0, 5000)

    if (current.heading || text) {
      sections.push({
        heading: current.heading,
        anchor: current.anchor,
        text
      })
    }

    current = { heading: '', anchor: '', text: [] }
  }

  const visit = (ids) => {
    for (const rawId of Array.isArray(ids) ? ids : []) {
      const block = byId.get(normalizeId(rawId))
      if (!block) continue

      const text = sanitizeSearchText(getBlockTitle(block))

      if (headingTypes.has(block.type) && text) {
        flush()
        const base = wikiHeadingId(text)
        const occurrence = (occurrences.get(base) || 0) + 1
        occurrences.set(base, occurrence)
        current.heading = text
        current.anchor = wikiHeadingId(text, occurrence)
      } else if (text) {
        current.text.push(text)
      }

      if (block.content?.length) visit(block.content)
    }
  }

  visit(pageBlock.content)
  flush()

  return sections.slice(0, 80)
}

function collectPlainText(recordMap) {
  const values = []
  const seen = new WeakSet()

  function visit(value, key = '') {
    if (typeof value === 'string') {
      const text = value.trim()
      if (
        text &&
        !/^https?:\/\//i.test(text) &&
        !/^attachment:/i.test(text) &&
        !/\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(text) &&
        !/^\d+(?:\.\d+)?\s*(?:B|KB|KiB|MB|MiB|GB|GiB)$/i.test(text) &&
        !/^[0-9a-f-]{32,36}$/i.test(text) &&
        !['id', 'parent_id', 'space_id'].includes(key)
      ) {
        values.push(text)
      }
      return
    }

    if (!value || typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)

    if (Array.isArray(value)) {
      for (const item of value) visit(item, key)
      return
    }

    for (const [childKey, item] of Object.entries(value)) {
      if (
        ['format', 'permissions', 'created_by_table', 'last_edited_by_table'].includes(
          childKey
        )
      ) {
        continue
      }
      visit(item, childKey)
    }
  }

  for (const block of blocks(recordMap)) {
    visit(block.properties || {})
  }

  return sanitizeSearchText([...new Set(values)].join(' ')).slice(0, 18000)
}

function toIsoDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
      cover: null,
      lastEdited: null,
      searchText: collectPlainText(recordMap),
      sections: []
    }
  }

  return {
    pageId: normalized,
    title: getBlockTitle(pageBlock) || '제목 없는 페이지',
    parentId: pageBlock.parent_id ? normalizeId(pageBlock.parent_id) : null,
    icon: pageBlock.format?.page_icon || null,
    cover: pageBlock.format?.page_cover || null,
    lastEdited: toIsoDate(pageBlock.last_edited_time),
    searchText: collectPlainText(recordMap),
    sections: collectSearchSections(recordMap, pageBlock)
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

function resolveIndexedAsset(value, manifest) {
  if (!value || typeof value !== 'string') return null

  const directKey = canonicalUrl(value)
  if (directKey && manifest[directKey]) return manifest[directKey]

  const attachmentMatch = value.match(/^attachment:([^:]+):/)
  const attachmentId = attachmentMatch?.[1]

  if (attachmentId) {
    const sourceKey = Object.keys(manifest).find((key) =>
      key.includes(`/${attachmentId}/`)
    )
    if (sourceKey) return manifest[sourceKey]
  }

  return null
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

async function readExistingIndex() {
  try {
    return JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'))
  } catch {
    return { pages: [] }
  }
}

function compactChangeSnippet(value, limit = 96) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, limit).trim()}…`
}

function changeSummaryFor(previous, current) {
  if (!previous) return '새 가이드 추가'
  if (previous.title !== current.title) return `문서명 변경 · ${current.title}`
  if (previous.searchText === current.searchText) {
    if (
      previous.lastEdited &&
      current.lastEdited &&
      previous.lastEdited !== current.lastEdited
    ) {
      return '표시 정보 업데이트 · 레이아웃·이미지 또는 문서 설정 변경'
    }
    return previous.changeSummary || null
  }

  const oldText = previous.searchText || ''
  const newText = current.searchText || ''

  let prefix = 0
  const maxPrefix = Math.min(oldText.length, newText.length)
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix += 1

  let oldEnd = oldText.length - 1
  let newEnd = newText.length - 1
  while (
    oldEnd >= prefix &&
    newEnd >= prefix &&
    oldText[oldEnd] === newText[newEnd]
  ) {
    oldEnd -= 1
    newEnd -= 1
  }

  const removed = compactChangeSnippet(oldText.slice(prefix, oldEnd + 1))
  const added = compactChangeSnippet(newText.slice(prefix, newEnd + 1))

  if (added && !removed) return `내용 추가 · ${added}`
  if (!added && removed) return `내용 정리 · ${removed}`
  if (added) return `내용 수정 · ${added}`
  return '본문 내용 업데이트'
}


function changeDetailFor(previous, current) {
  const summary = changeSummaryFor(previous, current)

  if (!previous) {
    return {
      type: 'added',
      summary,
      added: compactChangeSnippet(current.searchText, 140),
      removed: ''
    }
  }

  if (previous.title !== current.title) {
    return {
      type: 'renamed',
      summary,
      added: current.title,
      removed: previous.title
    }
  }

  if (previous.searchText === current.searchText) {
    if (previous.lastEdited !== current.lastEdited) {
      return {
        type: 'meta',
        summary,
        added: '',
        removed: ''
      }
    }
    return null
  }

  const oldText = previous.searchText || ''
  const newText = current.searchText || ''
  let prefix = 0
  const maxPrefix = Math.min(oldText.length, newText.length)
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix += 1

  let oldEnd = oldText.length - 1
  let newEnd = newText.length - 1
  while (
    oldEnd >= prefix &&
    newEnd >= prefix &&
    oldText[oldEnd] === newText[newEnd]
  ) {
    oldEnd -= 1
    newEnd -= 1
  }

  const removed = compactChangeSnippet(oldText.slice(prefix, oldEnd + 1), 140)
  const added = compactChangeSnippet(newText.slice(prefix, newEnd + 1), 140)

  return {
    type: added && removed ? 'updated' : added ? 'added-text' : 'removed-text',
    summary,
    added,
    removed
  }
}

function nextPageHistory(previous, current) {
  const existing = Array.isArray(previous?.history) ? previous.history : []
  const detail = changeDetailFor(previous, current)

  if (!detail) {
    if (!existing.length && current.lastEdited) {
      return [{
        at: current.lastEdited,
        type: 'baseline',
        summary: '변경 이력 추적 시작',
        added: null,
        removed: null
      }]
    }
    return existing.slice(0, 8)
  }

  const at =
    current.lastEdited ||
    previous?.lastEdited ||
    new Date().toISOString()

  if (
    existing[0]?.at === at &&
    existing[0]?.summary === detail.summary
  ) {
    return existing.slice(0, 8)
  }

  return [
    {
      at,
      type: detail.type,
      summary: detail.summary,
      added: detail.added || null,
      removed: detail.removed || null
    },
    ...existing
  ].slice(0, 8)
}

function buildFaqCandidates(pageIndex, verifiedFaq) {
  const verifiedSources = new Set(
    verifiedFaq
      .filter((entry) => entry?.sourceTitle && entry?.sourceAnchor)
      .map((entry) => `${entry.sourceTitle}:${entry.sourceAnchor}`)
  )
  const candidates = []

  for (const page of pageIndex) {
    if (page.title === '많이 물어보는 것') continue
    const text = String(page.searchText || '').trim()
    if (
      text.length < 80 ||
      /위키\s*업데이트\s*예정|내용\s*추가\s*예정|작성\s*중/i.test(text)
    ) {
      continue
    }

    for (const [index, section] of (page.sections || []).entries()) {
      const heading = String(section.heading || '').trim()
      const body = String(section.text || '').trim()
      if (!heading || heading.length > 120) continue

      const sourceKey = `${page.title}:${section.anchor || ''}`
      if (verifiedSources.has(sourceKey)) continue

      const ruleLike =
        /금지|허용|가능|필수|보상|사용|거래|재입주|수수료|등급|강화|수리|방법|어떻게|몇|조건/i.test(
          heading
        )
      const explanatory = body.length >= 35
      if (!ruleLike && !explanatory) continue

      candidates.push({
        id: `${page.pageId}:${section.anchor || index + 1}`,
        sourcePageId: page.pageId,
        sourceTitle: page.title,
        sourceAnchor: section.anchor || '',
        sourceHeading: heading,
        excerpt: compactChangeSnippet(body || heading, 160),
        reason: ruleLike ? '규칙·조건형 소제목' : '설명형 소제목',
        score: (ruleLike ? 30 : 12) + Math.min(20, Math.floor(body.length / 40))
      })
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.sourceTitle.localeCompare(b.sourceTitle, 'ko'))
    .slice(0, 24)
}

function buildReviewQueue(pageIndex, faqCandidates) {
  const changes = pageIndex
    .flatMap((page) => {
      const latest = Array.isArray(page.history) ? page.history[0] : null
      if (!latest || latest.type === 'baseline') return []
      return [{
        id: `change:${page.pageId}:${latest.at}`,
        kind: 'change',
        title: page.title,
        pageId: page.pageId,
        summary: latest.summary,
        at: latest.at
      }]
    })
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 8)

  const faq = faqCandidates.slice(0, 8).map((candidate) => ({
    id: `faq:${candidate.id}`,
    kind: 'faq-candidate',
    title: candidate.sourceTitle,
    pageId: candidate.sourcePageId,
    summary: candidate.sourceHeading,
    at: null
  }))

  return [...changes, ...faq].slice(0, 14)
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
    if (
      entry.name === 'manifest.json' ||
      entry.name === 'display-manifest.json' ||
      entry.name === 'index.json' ||
      entry.name === 'search-index.json'
    ) continue
    if (activeFilenames.has(entry.name)) continue

    await fs.unlink(path.join(OUT_DIR, entry.name))
    console.log(`[assets] removed stale file ${entry.name}`)
  }
}

function stablePageSnapshot(page) {
  return {
    pageId: page.pageId || null,
    title: page.title || '',
    parentId: page.parentId || null,
    lastEdited: page.lastEdited || null,
    searchText: page.searchText || '',
    sections: page.sections || [],
    changeSummary: page.changeSummary || null,
    history: Array.isArray(page.history) ? page.history : []
  }
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  const existingIndex = await readExistingIndex()
  const previousById = new Map((existingIndex.pages || []).map((page) => [page.pageId, page]))
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

  const verifiedFaq = await readVerifiedFaq()
  const faqSearch = verifiedFaqSearchPayload(verifiedFaq)

  const pageIndex = pages.map(({ meta }) => {
    const current = {
      ...meta,
      searchText:
        meta.title === '많이 물어보는 것' && faqSearch.searchText
          ? faqSearch.searchText
          : sanitizeSearchText(meta.searchText),
      sections:
        meta.title === '많이 물어보는 것' && faqSearch.sections.length
          ? faqSearch.sections
          : (meta.sections || []).map((section) => ({
              ...section,
              text: sanitizeSearchText(section.text)
            })),
      icon: resolveIndexedAsset(meta.icon, manifest),
      cover: resolveIndexedAsset(meta.cover, manifest)
    }
    const previous = previousById.get(current.pageId)
    const changeSummary = changeSummaryFor(previous, current)
    return {
      ...current,
      changeSummary,
      history: nextPageHistory(previous, current)
    }
  })

  const faqCandidates = buildFaqCandidates(pageIndex, verifiedFaq)
  const reviewQueue = buildReviewQueue(pageIndex, faqCandidates)

  const previousStablePages = (existingIndex.pages || []).map(stablePageSnapshot)
  const nextStablePages = pageIndex.map(stablePageSnapshot)
  const contentChanged = !sameJson(previousStablePages, nextStablePages)
  const manifestChanged = !sameJson(existingManifest, manifest)
  const generatedAt =
    contentChanged || manifestChanged || !existingIndex.generatedAt
      ? new Date().toISOString()
      : existingIndex.generatedAt

  await fs.writeFile(
    INDEX_PATH,
    JSON.stringify(
      {
        rootPageId: ROOT_PAGE_ID,
        generatedAt,
        pages: pageIndex,
        faqCandidates,
        reviewQueue
      },
      null,
      2
    ) + '\n',
    'utf8'
  )

  await fs.writeFile(
    SEARCH_INDEX_PATH,
    JSON.stringify(
      {
        generatedAt,
        pages: pageIndex
          .filter((page) => page.pageId !== ROOT_PAGE_ID)
          .map(({ pageId, title, searchText, sections }) => ({
            pageId,
            title,
            searchText,
            sections: sections || []
          }))
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
