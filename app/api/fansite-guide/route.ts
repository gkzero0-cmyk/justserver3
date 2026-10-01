import { readNotionIndex } from '../../../lib/notion-index.ts'
import { buildFansiteGuideFeed } from '../../../lib/fansite-guide-feed.ts'

export async function GET() {
  const index = await readNotionIndex()
  const body = buildFansiteGuideFeed(index)

  return Response.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
