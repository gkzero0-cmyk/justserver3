'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useEffect, useRef } from 'react'

import { iconForTitle } from '@/lib/wiki-taxonomy'
import { withBasePath } from '@/lib/url-utils'
import { wikiGuidePath } from '@/lib/wiki-routes'

export type ReadingTocItem = {
  id: string
  text: string
  level: number
}

type RecentPage = {
  pageId: string
  title: string
}

export function RecentViewedSection({
  ready,
  pages,
  onClear
}: {
  ready: boolean
  pages: RecentPage[]
  onClear: () => void
}) {
  return (
    <section
      className={`recent-viewed ${!ready ? 'is-loading' : pages.length ? '' : 'is-empty'}`}
      aria-labelledby="recent-viewed-title"
      aria-busy={!ready}
    >
      <div className="recent-viewed-head">
        <div>
          <p>CONTINUE READING</p>
          <h2 id="recent-viewed-title">이어서 읽기</h2>
        </div>
        <div className="recent-viewed-actions">
          <small>이 브라우저에만 저장됩니다.</small>
          {ready && pages.length > 0 && (
            <button type="button" onClick={onClear}>
              기록 지우기
            </button>
          )}
        </div>
      </div>

      {!ready ? (
        <div
          className="recent-viewed-list recent-viewed-loading"
          aria-hidden="true"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <span className="recent-viewed-skeleton" key={index} />
          ))}
        </div>
      ) : pages.length > 0 ? (
        <div className="recent-viewed-list">
          {pages.map((page, index) => (
            <Link
              key={page.pageId}
              href={withBasePath(wikiGuidePath(page))}
              className={`recent-viewed-card ${index === 0 ? 'is-primary' : ''}`}
              data-wiki-event="wiki_home_navigate"
              data-wiki-section="recent-viewed"
              data-wiki-target={page.title}
              data-wiki-status="ready"
            >
              <span aria-hidden="true">{iconForTitle(page.title)}</span>
              <strong>{page.title}</strong>
              <b>→</b>
            </Link>
          ))}
        </div>
      ) : (
        <p className="recent-viewed-empty">
          아직 본 문서가 없습니다. 가이드를 열면 최근 기록이 여기에 표시됩니다.
        </p>
      )}
    </section>
  )
}

export function MobileTocSheet({
  toc,
  readingProgress,
  activeTocId,
  onClose,
  onNavigate
}: {
  toc: ReadingTocItem[]
  readingProgress: number
  activeTocId: string
  onClose: () => void
  onNavigate: (id: string) => void
}) {
  const sheetRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    track('wiki_mobile_toc_open')
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => closeRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !sheetRef.current) return

      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'))

      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
  }, [onClose])

  return (
    <div
      className="mobile-toc-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        ref={sheetRef}
        className="mobile-toc-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-toc-title"
      >
        <div className="mobile-toc-handle" aria-hidden="true" />
        <header>
          <div>
            <small>현재 문서</small>
            <strong id="mobile-toc-title">목차</strong>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="목차 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="mobile-toc-progress">
          <span>읽는 중</span>
          <b>{readingProgress}%</b>
        </div>
        <nav>
          {toc.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mobile-toc-item level-${item.level} ${activeTocId === item.id ? 'is-active' : ''}`}
              aria-current={activeTocId === item.id ? 'location' : undefined}
              onClick={() => {
                track('wiki_mobile_toc_navigate')
                onNavigate(item.id)
              }}
            >
              <span>{iconForTitle(item.text)}</span>
              <strong>{item.text}</strong>
            </button>
          ))}
        </nav>
      </section>
    </div>
  )
}
