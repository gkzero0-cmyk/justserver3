import { createHash } from 'node:crypto'

import {
  buildWikiFeedbackIssue,
  validateWikiFeedbackPayload
} from '@/lib/wiki-feedback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 3

const buckets = new Map<string, { count: number; resetAt: number }>()

function clientBucketKey(request: Request) {
  const forwardedFor =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  return createHash('sha256')
    .update(`${forwardedFor}|${userAgent}`)
    .digest('hex')
    .slice(0, 24)
}

function rateLimited(request: Request) {
  const now = Date.now()
  const key = clientBucketKey(request)
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) return true

  existing.count += 1
  return false
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

async function createFeedbackIssue({
  title,
  body
}: {
  title: string
  body: string
}) {
  const token = process.env.GITHUB_FEEDBACK_TOKEN
  if (!token) return null

  const response = await fetch(
    'https://api.github.com/repos/gkzero0-cmyk/justserver3/issues',
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, body }),
      cache: 'no-store'
    }
  )

  if (!response.ok) {
    throw new Error(`feedback-store-http-${response.status}`)
  }

  return (await response.json()) as {
    number?: number
  }
}

async function notifyDiscord({
  title,
  body,
  issueNumber
}: {
  title: string
  body: string
  issueNumber?: number
}) {
  const webhook = process.env.DISCORD_FEEDBACK_WEBHOOK_URL
  if (!webhook) return false

  const excerpt = body.length > 3200 ? `${body.slice(0, 3197)}…` : body
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: '적자생존 위키 제보',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title,
          description: excerpt,
          footer: {
            text: issueNumber
              ? `사이트 제보 #${issueNumber}`
              : '사이트 제보'
          }
        }
      ]
    }),
    cache: 'no-store'
  })

  return response.ok
}

export async function GET() {
  return Response.json(
    {
      ready: Boolean(process.env.GITHUB_FEEDBACK_TOKEN),
      discordNotification: Boolean(process.env.DISCORD_FEEDBACK_WEBHOOK_URL)
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  )
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 8192) {
    return Response.json(
      { ok: false, error: 'payload-too-large' },
      { status: 413 }
    )
  }

  if (!sameOrigin(request)) {
    return Response.json(
      { ok: false, error: 'invalid-origin' },
      { status: 403 }
    )
  }

  if (rateLimited(request)) {
    return Response.json(
      { ok: false, error: 'rate-limited' },
      {
        status: 429,
        headers: { 'Retry-After': '600' }
      }
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json(
      { ok: false, error: 'invalid-json' },
      { status: 400 }
    )
  }

  const validated = validateWikiFeedbackPayload(raw)
  if (!validated.ok) {
    return Response.json(
      { ok: false, error: validated.error },
      { status: 400 }
    )
  }

  if (validated.value.website) {
    return Response.json({ ok: true, accepted: true })
  }

  if (!process.env.GITHUB_FEEDBACK_TOKEN) {
    return Response.json(
      { ok: false, error: 'feedback-store-not-configured' },
      { status: 503 }
    )
  }

  const issue = buildWikiFeedbackIssue(
    validated.value,
    new Date().toISOString()
  )

  try {
    const stored = await createFeedbackIssue(issue)
    const discordNotified = await notifyDiscord({
      ...issue,
      issueNumber: stored?.number
    }).catch(() => false)

    return Response.json({
      ok: true,
      accepted: true,
      reference: stored?.number ?? null,
      discordNotified
    })
  } catch {
    return Response.json(
      { ok: false, error: 'feedback-store-unavailable' },
      { status: 502 }
    )
  }
}
