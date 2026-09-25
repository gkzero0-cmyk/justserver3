'use client'

import Link from 'next/link'

import { withBasePath } from '@/lib/url-utils'

export function WikiMobileNavigation({
  home,
  readingProgress,
  hasToc,
  onOpenSearch,
  onOpenQuick,
  onOpenToc
}: {
  home: boolean
  readingProgress: number
  hasToc: boolean
  onOpenSearch: () => void
  onOpenQuick: () => void
  onOpenToc: () => void
}) {
  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="모바일 빠른 메뉴">
        <Link href={withBasePath('/')} prefetch={false}>
          <span aria-hidden="true">⌂</span>
          <strong>홈</strong>
        </Link>
        <button type="button" onClick={onOpenSearch}>
          <span aria-hidden="true">⌕</span>
          <strong>검색</strong>
        </button>
        <button type="button" onClick={onOpenQuick}>
          <span aria-hidden="true">⚡</span>
          <strong>빠른정보</strong>
        </button>
        <Link href={withBasePath('/#wiki-explore')} prefetch={false}>
          <span aria-hidden="true">✦</span>
          <strong>탐험</strong>
        </Link>
        <Link href={withBasePath('/#wiki-survival-log-title')} prefetch={false}>
          <span aria-hidden="true">☰</span>
          <strong>내 기록</strong>
        </Link>
      </nav>

      {!home && (
        <div
          className={`mobile-reading-tools ${
            readingProgress > 2 ? 'is-visible' : ''
          }`}
        >
          {hasToc && (
            <button
              type="button"
              onClick={onOpenToc}
              aria-label="현재 문서 목차 열기"
            >
              ☷ <span>목차</span>
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
            aria-label="페이지 맨 위로 이동"
          >
            ↑ <span>위로</span>
          </button>
        </div>
      )}
    </>
  )
}
