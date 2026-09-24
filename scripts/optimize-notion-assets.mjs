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

async function optimizeAsset(publicPath) {
  if (!publicPath?.startsWith('/notion-assets/')) return publicPath

  const sourceFile = path.join(process.cwd(), 'public', publicPath)
  const ext = path.extname(sourceFile).toLowerCase()

  if (!['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp'].includes(ext)) {
    return publicPath
  }

  const sourceBytes = await fs.readFile(sourceFile)
  const hash = hashBytes(sourceBytes)
  const outputName = `${hash}.webp`
  const outputDiskPath = path.join(OPTIMIZED_DIR, outputName)
  const outputPublicPath = `/notion-assets/optimized/${outputName}`

  let optimizedBytes
  try {
    optimizedBytes = await sharp(sourceBytes)
      .rotate()
      .resize({
        width: 1920,
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({
        quality: 88,
        alphaQuality: 95,
        effort: 5,
        smartSubsample: true
      })
      .toBuffer()
  } catch (error) {
    console.warn(`[optimize] skipped ${publicPath}: ${error?.message || error}`)
    return publicPath
  }

  if (optimizedBytes.length >= sourceBytes.length * 0.94) {
    return publicPath
  }

  try {
    await fs.access(outputDiskPath)
  } catch {
    await fs.writeFile(outputDiskPath, optimizedBytes)
  }

  return outputPublicPath
}

async function main() {
  await fs.mkdir(OPTIMIZED_DIR, { recursive: true })

  const sourceManifest = await readJson(MANIFEST_PATH, {})
  const displayManifest = {}
  const pathMap = new Map()
  const activeOptimized = new Set()

  let optimizedCount = 0
  let reusedCount = 0
  let originalBytes = 0
  let displayBytes = 0

  for (const [sourceUrl, publicPath] of Object.entries(sourceManifest)) {
    if (!pathMap.has(publicPath)) {
      const sourceFile = path.join(process.cwd(), 'public', publicPath)
      let before = 0

      try {
        before = (await fs.stat(sourceFile)).size
      } catch {}

      const displayPath = await optimizeAsset(publicPath)
      pathMap.set(publicPath, displayPath)

      let after = before
      if (displayPath !== publicPath) {
        optimizedCount += 1
        activeOptimized.add(path.basename(displayPath))
        try {
          after = (
            await fs.stat(path.join(process.cwd(), 'public', displayPath))
          ).size
        } catch {}
      }

      originalBytes += before
      displayBytes += after
    } else {
      reusedCount += 1
    }

    displayManifest[sourceUrl] = pathMap.get(publicPath)
  }

  const index = await readJson(INDEX_PATH, null)
  if (index?.pages) {
    index.pages = index.pages.map((page) => ({
      ...page,
      icon: page.icon ? pathMap.get(page.icon) || page.icon : null,
      cover: page.cover ? pathMap.get(page.cover) || page.cover : null
    }))

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

  const entries = await fs.readdir(OPTIMIZED_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!activeOptimized.has(entry.name)) {
      await fs.unlink(path.join(OPTIMIZED_DIR, entry.name))
    }
  }

  const saved = Math.max(0, originalBytes - displayBytes)
  console.log(
    `[optimize] ${optimizedCount} display images, ${reusedCount} duplicate mappings, saved ~${(
      saved /
      1024 /
      1024
    ).toFixed(1)} MB for rendered assets`
  )
}

main().catch((error) => {
  console.error(`[optimize] failed: ${error?.stack || error}`)
  process.exit(1)
})
