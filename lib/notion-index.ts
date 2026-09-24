import fs from 'node:fs'
import path from 'node:path'

export type NotionIndexPage = {
  pageId: string
  title: string
  parentId: string | null
  icon: string | null
  cover: string | null
}

export type NotionIndex = {
  rootPageId: string
  generatedAt: string | null
  pages: NotionIndexPage[]
}

const EMPTY_INDEX: NotionIndex = {
  rootPageId: '3dad57d6a55c80469f3de9730cb88975',
  generatedAt: null,
  pages: []
}

export function readNotionIndex(): NotionIndex {
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
