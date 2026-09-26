import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    {
      commit:
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.GITHUB_SHA ||
        'unknown',
      environment: process.env.VERCEL_ENV || 'unknown'
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  )
}
