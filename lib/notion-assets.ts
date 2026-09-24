import fs from 'node:fs'
import path from 'node:path'

export type NotionAssetManifest = Record<string, string>

export function readNotionAssetManifest(): NotionAssetManifest {
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
