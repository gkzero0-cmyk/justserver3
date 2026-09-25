import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const OUT_DIR = path.join(process.cwd(), 'public', 'notion-assets')
const OPTIMIZED_DIR = path.join(OUT_DIR, 'optimized')
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json')
const DISPLAY_MANIFEST_PATH = path.join(OUT_DIR, 'display-manifest.json')
const INDEX_PATH = path.join(OUT_DIR, 'index.json')

function hashBytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 24)
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

async function ensureVariant({
  sourceBytes,
  hash,
  kind,
  width,
  quality,
  alphaQuality = 94,
  fallbackPublicPath,
  compareToSource = false
}) {
  const relative = kind === 'display' ? `${hash}.webp` : `${kind}/${hash}.webp`
  const outputDiskPath = path.join(OPTIMIZED_DIR, relative)
  const outputPublicPath = `/notion-assets/optimized/${relative.replaceAll('\\', '/')}`

  let bytes
  try {
    bytes = await sharp(sourceBytes)
      .rotate()
      .resize({
        width,
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({
        quality,
        alphaQuality,
        effort: 5,
        smartSubsample: true
      })
      .toBuffer()
  } catch (error) {
    console.warn(`[optimize] ${kind} skipped: ${error?.message || error}`)
    return {
      publicPath: fallbackPublicPath,
      bytes: sourceBytes.length,
      relative: null
    }
  }

  if (compareToSource && bytes.length >= sourceBytes.length * 0.94) {
    return {
      publicPath: fallbackPublicPath,
      bytes: sourceBytes.length,
      relative: null
    }
  }

  await fs.mkdir(path.dirname(outputDiskPath), { recursive: true })

  try {
    await fs.access(outputDiskPath)
  } catch {
    await fs.writeFile(outputDiskPath, bytes)
  }

  return {
    publicPath: outputPublicPath,
    bytes: bytes.length,
    relative: relative.replaceAll('\\', '/')
  }
}

async function optimizeAsset(publicPath, { makeHero = false, makeLogo = false } = {}) {
  if (!publicPath?.startsWith('/notion-assets/')) {
    return {
      display: publicPath,
      thumbnail: publicPath,
      hero: makeHero ? publicPath : null,
      logo: makeLogo ? publicPath : null,
      sourceBytes: 0,
      displayBytes: 0,
      thumbnailBytes: 0,
      active: []
    }
  }

  const sourceFile = path.join(process.cwd(), 'public', publicPath)
  const ext = path.extname(sourceFile).toLowerCase()

  if (!['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp'].includes(ext)) {
    return {
      display: publicPath,
      thumbnail: publicPath,
      hero: makeHero ? publicPath : null,
      logo: makeLogo ? publicPath : null,
      sourceBytes: 0,
      displayBytes: 0,
      thumbnailBytes: 0,
      active: []
    }
  }

  const sourceBytes = await fs.readFile(sourceFile)
  const hash = hashBytes(sourceBytes)
  const display = await ensureVariant({
    sourceBytes,
    hash,
    kind: 'display',
    width: 1920,
    quality: 88,
    alphaQuality: 95,
    fallbackPublicPath: publicPath,
    compareToSource: true
  })
  const thumbnail = await ensureVariant({
    sourceBytes,
    hash,
    kind: 'thumb',
    width: 480,
    quality: 82,
    alphaQuality: 92,
    fallbackPublicPath: display.publicPath
  })
  const hero = makeHero
    ? await ensureVariant({
        sourceBytes,
        hash,
        kind: 'hero',
        width: 1600,
        quality: 86,
        alphaQuality: 94,
        fallbackPublicPath: display.publicPath
      })
    : null
  const logo = makeLogo
    ? await ensureVariant({
        sourceBytes,
        hash,
        kind: 'logo',
        width: 256,
        quality: 92,
        alphaQuality: 98,
        fallbackPublicPath: display.publicPath
      })
    : null

  return {
    display: display.publicPath,
    thumbnail: thumbnail.publicPath,
    hero: hero?.publicPath ?? null,
    logo: logo?.publicPath ?? null,
    sourceBytes: sourceBytes.length,
    displayBytes: display.bytes,
    thumbnailBytes: thumbnail.bytes,
    active: [display.relative, thumbnail.relative, hero?.relative, logo?.relative].filter(Boolean)
  }
}

async function listFilesRecursive(dir, prefix = '') {
  const result = []

  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return result
  }

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    const diskPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      result.push(...(await listFilesRecursive(diskPath, relative)))
    } else if (entry.isFile()) {
      result.push(relative)
    }
  }

  return result
}

async function main() {
  await fs.mkdir(OPTIMIZED_DIR, { recursive: true })

  const sourceManifest = await readJson(MANIFEST_PATH, {})
  const index = await readJson(INDEX_PATH, null)
  const rootPage =
    index?.pages?.find(
      (page) => String(page.pageId || '').replaceAll('-', '') === String(index.rootPageId || '').replaceAll('-', '')
    ) ?? null
  const rootCover = rootPage?.cover ?? null
  const rootIcon = rootPage?.icon ?? null

  const displayManifest = {}
  const pathMap = new Map()
  const activeOptimized = new Set()

  let originalBytes = 0
  let displayBytes = 0
  let thumbnailBytes = 0
  let duplicateMappings = 0

  const uniquePaths = [...new Set(Object.values(sourceManifest))]

  for (const publicPath of uniquePaths) {
    const variants = await optimizeAsset(publicPath, {
      makeHero: publicPath === rootCover,
      makeLogo: publicPath === rootIcon
    })

    pathMap.set(publicPath, variants)
    originalBytes += variants.sourceBytes
    displayBytes += variants.displayBytes
    thumbnailBytes += variants.thumbnailBytes
    for (const relative of variants.active) activeOptimized.add(relative)
  }

  for (const [sourceUrl, publicPath] of Object.entries(sourceManifest)) {
    const variants = pathMap.get(publicPath)
    if (!variants) {
      displayManifest[sourceUrl] = publicPath
      continue
    }
    displayManifest[sourceUrl] = variants.display
  }

  duplicateMappings = Object.keys(sourceManifest).length - uniquePaths.length

  if (index?.pages) {
    index.pages = index.pages.map((page) => {
      const coverVariants = page.cover ? pathMap.get(page.cover) : null
      const iconVariants = page.icon ? pathMap.get(page.icon) : null
      const isRoot =
        String(page.pageId || '').replaceAll('-', '') ===
        String(index.rootPageId || '').replaceAll('-', '')

      return {
        ...page,
        icon: iconVariants?.display || page.icon || null,
        cover: coverVariants?.display || page.cover || null,
        thumbnail:
          coverVariants?.thumbnail || iconVariants?.thumbnail || null,
        hero: isRoot
          ? coverVariants?.hero || coverVariants?.display || page.cover || null
          : null,
        logo: isRoot
          ? iconVariants?.logo || iconVariants?.display || page.icon || null
          : null
      }
    })

    index.assetStats = {
      originalBytes,
      displayBytes,
      thumbnailBytes,
      uniqueSourceImages: uniquePaths.length,
      duplicateMappings
    }

    await fs.writeFile(
      INDEX_PATH,
      JSON.stringify(index, null, 2) + '\n',
      'utf8'
    )
  }

  await fs.writeFile(
    DISPLAY_MANIFEST_PATH,
    JSON.stringify(displayManifest, null, 2) + '\n',
    'utf8'
  )

  for (const relative of await listFilesRecursive(OPTIMIZED_DIR)) {
    if (activeOptimized.has(relative)) continue
    await fs.unlink(path.join(OPTIMIZED_DIR, relative))
  }

  const saved = Math.max(0, originalBytes - displayBytes)
  console.log(
    `[optimize] ${uniquePaths.length} unique sources, ${duplicateMappings} duplicate mappings, display saved ~${(
      saved /
      1024 /
      1024
    ).toFixed(1)} MB, thumbnails ~${(thumbnailBytes / 1024 / 1024).toFixed(1)} MB`
  )
}

main().catch((error) => {
  console.error(`[optimize] failed: ${error?.stack || error}`)
  process.exit(1)
})
