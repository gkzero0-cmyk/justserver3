import { createHmac, timingSafeEqual } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SEARCH_INDEX_URL =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/search-index.json'

type NotionWebhookPayload = {
  verification_token?: string
  type?: string
  entity?: {
    id?: string
    type?: string
  }
  data?: unknown
  [key: string]: unknown
}

function verifySignature(body: string, signature: string | null) {
  const token = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN
  if (!token) return null
  if (!signature) return false

  const expected = `sha256=${createHmac('sha256', token)
    .update(body)
    .digest('hex')}`

  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== actualBuffer.length) return false
  return timingSafeEqual(expectedBuffer, actualBuffer)
}

async function triggerAssetSync() {
  const token = process.env.GITHUB_ACTIONS_TOKEN
  if (!token) return { triggered: false, reason: 'token-not-configured' }

  const response = await fetch(
    'https://api.github.com/repos/gkzero0-cmyk/justserver3/actions/workflows/sync-notion-assets.yml/dispatches',
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: 'main' }),
      cache: 'no-store'
    }
  )

  return {
    triggered: response.ok,
    status: response.status
  }
}

function normalizePageId(value?: string) {
  return value?.replaceAll('-', '') || null
}

async function searchIndexResponse() {
  const response = await fetch(SEARCH_INDEX_URL, {
    headers: {
      'Cache-Control': 'no-cache'
    },
    next: {
      revalidate: 60,
      tags: ['notion-search']
    }
  })

  if (!response.ok) {
    return Response.json(
      { pages: [], error: 'search-index-unavailable' },
      { status: 502 }
    )
  }

  return new Response(await response.text(), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  if (url.searchParams.get('resource') === 'search-index') {
    return searchIndexResponse()
  }

  return Response.json({
    ready: true,
    endpoint: '/api/notion-webhook',
    signatureValidation:
      Boolean(process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN),
    instantAssetSync: Boolean(process.env.GITHUB_ACTIONS_TOKEN),
    fallbackSyncMinutes: 5,
    liveContentCacheSeconds: 3600
  })
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  let payload: NotionWebhookPayload
  try {
    payload = JSON.parse(rawBody) as NotionWebhookPayload
  } catch {
    return Response.json({ ok: false, error: 'invalid-json' }, { status: 400 })
  }

  if (payload.verification_token) {
    console.info(
      '[notion-webhook] verification-token',
      payload.verification_token
    )

    return Response.json({
      ok: true,
      verificationReceived: true
    })
  }

  const signature = request.headers.get('x-notion-signature')
  const verified = verifySignature(rawBody, signature)

  if (verified === null) {
    return Response.json(
      { ok: false, error: 'webhook-not-verified' },
      { status: 503 }
    )
  }

  if (!verified) {
    return Response.json(
      { ok: false, error: 'invalid-signature' },
      { status: 401 }
    )
  }

  const pageId = normalizePageId(payload.entity?.id)

  revalidateTag('notion-page', 'max')
  revalidateTag('notion-index', 'max')
  revalidateTag('notion-assets', 'max')
  revalidateTag('notion-search', 'max')
  revalidatePath('/')

  if (pageId) {
    revalidatePath(`/page/${pageId}`)
  }

  const assetSync = await triggerAssetSync().catch(() => ({
    triggered: false,
    reason: 'dispatch-failed'
  }))

  console.info('[notion-webhook] event', {
    type: payload.type || 'unknown',
    pageId,
    verified: true,
    assetSync
  })

  return Response.json({
    ok: true,
    revalidated: true,
    pageId,
    eventType: payload.type || null,
    assetSync
  })
}
