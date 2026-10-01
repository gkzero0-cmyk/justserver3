import { readNotionAssetManifest, readNotionIndex } from '../../../lib/notion-index'
import { getNotionPage } from '../../../lib/notion'
import { buildFansiteGuideFeed, isPublicGuidePage } from '../../../lib/fansite-guide-feed'
import { extractFansiteGuideDocument } from '../../../lib/fansite-guide-document'

const headers = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800',
  'Access-Control-Allow-Origin': '*',
  'X-Content-Type-Options': 'nosniff'
}

export async function GET(request: Request) {
  const index = await readNotionIndex()
  const pageId = new URL(request.url).searchParams.get('pageId')?.replaceAll('-', '') || ''

  if (!pageId) {
    return Response.json(buildFansiteGuideFeed(index), { headers })
  }

  const page = index.pages.find((item) =>
    item.pageId.replaceAll('-', '') === pageId && isPublicGuidePage(item)
  )
  if (!page) {
    return Response.json({ error: 'guide_not_found' }, { status: 404, headers })
  }

  const [recordMap, manifest] = await Promise.all([
    getNotionPage(page.pageId),
    readNotionAssetManifest()
  ])
  const document = extractFansiteGuideDocument(recordMap, page.pageId, manifest)

  return Response.json({
    schema: 'official-wiki-guide-document-v1',
    source: 'https://server1.wiki.xn--9i1bk7xhlfi8hzzf.com/',
    generatedAt: index.generatedAt || null,
    page: {
      pageId: page.pageId,
      title: page.title,
      parentId: page.parentId,
      lastEdited: page.lastEdited,
      cover: page.cover,
      sections: page.sections || []
    },
    document
  }, { headers })
}
