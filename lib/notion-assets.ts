import fs from 'node:fs'
import path from 'node:path'

export type NotionAssetManifest = Record<string, string>

const REMOTE_MANIFEST =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/display-manifest.json?v=20260925-2'
const FALLBACK_MANIFEST =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/manifest.json?v=20260925-2'

function readLocalManifest(): NotionAssetManifest {
  try {
    const manifestPath = path.join(
      process.cwd(),
      'public',
      'notion-assets',
      'manifest.json'
    )

    return JSON.parse(
      fs.readFileSync(manifestPath, 'utf8')
    ) as NotionAssetManifest
  } catch {
    return {}
  }
}

export async function readNotionAssetManifest(): Promise<NotionAssetManifest> {
  try {
    const response = await fetch(REMOTE_MANIFEST, {
      next: { revalidate: 300 }
    })

    if (response.ok) {
      return (await response.json()) as NotionAssetManifest
    }

    const fallback = await fetch(FALLBACK_MANIFEST, {
      next: { revalidate: 300 }
    })
    if (!fallback.ok) throw new Error(`HTTP ${fallback.status}`)
    return (await fallback.json()) as NotionAssetManifest
  } catch {
    return readLocalManifest()
  }
}
