import fs from 'node:fs'
import path from 'node:path'

export type NotionIndexPage = {
  pageId: string
  title: string
  parentId: string | null
  icon: string | null
  cover: string | null
  lastEdited: string | null
  searchText: string
  changeSummary?: string | null
  thumbnail?: string | null
  hero?: string | null
  logo64?: string | null
  logo128?: string | null
  logo?: string | null
}

export type NotionAssetStats = {
  originalBytes: number
  displayBytes: number
  thumbnailBytes: number
  uniqueSourceImages: number
  duplicateMappings: number
}

export type NotionIndex = {
  rootPageId: string
  generatedAt: string | null
  pages: NotionIndexPage[]
  assetStats?: NotionAssetStats
}

const REMOTE_INDEX =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/index.json?v=20260925-2'

const EMPTY_INDEX: NotionIndex = {
  rootPageId: '3dad57d6a55c80469f3de9730cb88975',
  generatedAt: null,
  pages: []
}

function readLocalIndex(): NotionIndex {
  try {
    const indexPath = path.join(
      process.cwd(),
      'public',
      'notion-assets',
      'index.json'
    )

    return JSON.parse(fs.readFileSync(indexPath, 'utf8')) as NotionIndex
  } catch {
    return EMPTY_INDEX
  }
}

export async function readNotionIndex(): Promise<NotionIndex> {
  try {
    const response = await fetch(REMOTE_INDEX, {
      cache: 'no-store'
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as NotionIndex
  } catch {
    return readLocalIndex()
  }
}
