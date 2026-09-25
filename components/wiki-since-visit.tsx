'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { withBasePath } from '@/lib/url-utils'

type ChangedPage = {
  pageId: string
  title: string
  lastEdited: string | null
  summary?: string | null
}

const KEY = 'justserver3-last-home-visit'

export function WikiSinceVisit({ pages }: { pages: ChangedPage[] }) {
  const [previousVisit, setPreviousVisit] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? Number(raw) : 0
    setPreviousVisit(Number.isFinite(parsed) ? parsed : 0)
    setReady(true)
    window.localStorage.setItem(KEY, String(Date.now()))
  }, [])

  const changed = useMemo(() => {
    if (!ready || previousVisit === null || previousVisit <= 0) return []
    return pages
      .filter((page) => {
        if (!page.lastEdited) return false
        const edited = new Date(page.lastEdited).getTime()
        return Number.isFinite(edited) && edited > previousVisit
      })
      .slice(0, 5)
  }, [pages, previousVisit, ready])

  if (!ready || !changed.length) return null

  return (
    <section className="since-visit" aria-labelledby="since-visit-title">
      <div className="since-visit-head">
        <div>
          <p>SINCE YOUR LAST VISIT</p>
          <h2 id="since-visit-title">지난 방문 이후 바뀐 내용</h2>
        </div>
        <strong>{changed.length}개</strong>
      </div>
      <div className="since-visit-list">
        {changed.map((page) => (
          <Link
            key={page.pageId}
            href={withBasePath(`/page/${page.pageId}/`)}
            data-wiki-event="wiki_since_visit_open"
            data-wiki-section="since-visit"
            data-wiki-target={page.title}
            data-wiki-status="changed"
          >
            <strong>{page.title}</strong>
            <span>{page.summary || '문서 내용이 업데이트되었습니다.'}</span>
            <b aria-hidden="true">→</b>
          </Link>
        ))}
      </div>
    </section>
  )
}
