import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const assetDir = path.join(root, 'public', 'notion-assets')
const displayManifestPath = path.join(assetDir, 'display-manifest.json')
const indexPath = path.join(assetDir, 'index.json')
const sourceImagePattern = /\.(?:png|jpe?g|webp|avif|bmp)$/i

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

function collectAssetRefs(value, refs = []) {
  if (typeof value === 'string') {
    if (value.startsWith('/notion-assets/')) refs.push(value)
    return refs
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectAssetRefs(entry, refs)
    return refs
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectAssetRefs(entry, refs)
  }
  return refs
}

async function main() {
  if (process.env.VERCEL !== '1') {
    console.log('[runtime-assets] outside Vercel build; source originals kept')
    return
  }

  const [displayManifest, index] = await Promise.all([
    readJson(displayManifestPath),
    readJson(indexPath)
  ])

  const refs = [
    ...Object.values(displayManifest),
    ...collectAssetRefs(index)
  ].map(String)

  const unsafe = [...new Set(refs)].filter(
    (value) =>
      value.startsWith('/notion-assets/') &&
      !value.startsWith('/notion-assets/optimized/')
  )

  if (unsafe.length) {
    throw new Error(
      '[runtime-assets] refusing to remove originals; runtime still references: ' +
        unsafe.slice(0, 8).join(', ')
    )
  }

  const entries = await fs.readdir(assetDir, { withFileTypes: true })
  let removedFiles = 0
  let removedBytes = 0

  for (const entry of entries) {
    if (!entry.isFile() || !sourceImagePattern.test(entry.name)) continue
    const filePath = path.join(assetDir, entry.name)
    const stat = await fs.stat(filePath)
    await fs.unlink(filePath)
    removedFiles += 1
    removedBytes += stat.size
  }

  console.log(
    `[runtime-assets] removed ${removedFiles} source images (${(
      removedBytes /
      1024 /
      1024
    ).toFixed(1)} MB); optimized WebP assets remain in Production`
  )
}

await main()
