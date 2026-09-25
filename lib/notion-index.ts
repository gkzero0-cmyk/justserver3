import fs from 'node:fs'
import path from 'node:path'
import { cache } from 'react'

export type NotionPageHistoryEntry = {
  at: string
  type: string
  summary: string | null
  added?: string | null
  removed?: string | null
}

export type NotionFaqCandidate = {
  id: string
  sourcePageId: string
  sourceTitle: string
  sourceAnchor: string
  sourceHeading: string
  excerpt: string
  reason: string
  score: number
}

export type NotionReviewQueueItem = {
  id: string
  kind: 'change' | 'faq-candidate'
  title: string
  pageId: string
  summary: string | null
  at: string | null
}

export type NotionIndexPage = {
  pageId: string
  title: string
  parentId: string | null
  icon: string | null
  cover: string | null
  lastEdited: string | null
  searchText: string
  changeSummary?: string | null
  history?: NotionPageHistoryEntry[]
  thumbnail?: string | null
  thumbnailSmall?: string | null
  hero?: string | null
  hero768?: string | null
  hero1280?: string | null
  hero1600?: string | null
  logo64?: string | null
  logo128?: string | null
  logo?: string | null
}

export type NotionAssetManifest = Record<string, string>

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
  faqCandidates?: NotionFaqCandidate[]
  reviewQueue?: NotionReviewQueueItem[]
}

const REMOTE_INDEX =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/index.json?v=20260925-4'

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

async function readNotionIndexUncached(): Promise<NotionIndex> {
  try {
    const response = await fetch(REMOTE_INDEX, {
      headers: {
        'Cache-Control': 'no-cache'
      },
      next: {
        revalidate: 60,
        tags: ['notion-index']
      }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as NotionIndex
  } catch {
    return readLocalIndex()
  }
}

export const readNotionIndex = cache(readNotionIndexUncached)

const REMOTE_MANIFEST =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/display-manifest.json?v=20260925-4'
const FALLBACK_MANIFEST =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/manifest.json?v=20260925-4'

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

async function readNotionAssetManifestUncached(): Promise<NotionAssetManifest> {
  try {
    const response = await fetch(REMOTE_MANIFEST, {
      headers: {
        'Cache-Control': 'no-cache'
      },
      next: {
        revalidate: 60,
        tags: ['notion-assets']
      }
    })

    if (response.ok) {
      return (await response.json()) as NotionAssetManifest
    }

    const fallback = await fetch(FALLBACK_MANIFEST, {
      headers: {
        'Cache-Control': 'no-cache'
      },
      next: {
        revalidate: 60,
        tags: ['notion-assets']
      }
    })
    if (!fallback.ok) throw new Error(`HTTP ${fallback.status}`)
    return (await fallback.json()) as NotionAssetManifest
  } catch {
    return readLocalManifest()
  }
}

export const readNotionAssetManifest = cache(readNotionAssetManifestUncached)
