'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { iconForTitle } from '@/lib/wiki-taxonomy'
import type { WikiContentStatus } from '@/lib/wiki-ux'
import { withBasePath } from '@/lib/url-utils'
import { wikiGuidePath } from '@/lib/wiki-routes'

export type WikiSearchResult = {
  pageId: string
  title: string
  category: string
  status: WikiContentStatus | null
  snippet?: string
  findTerm?: string
  sectionTitle?: string
  anchor?: string
  resultKey?: string
}

function HighlightedText({
  text,
  query
}: {
  text: string
  query: string
}) {
  const keyword = query.trim()
  if (!keyword) return <>{text}</>

  const lower = text.toLowerCase()
  const index = lower.indexOf(keyword.toLowerCase())
  if (index < 0) return <>{text}</>

  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + keyword.length)}</mark>
      {text.slice(index + keyword.length)}
    </>
  )
}

export function WikiSearchDialog({
  query,
  loading,
  failed,
  results,
  fallbackPages,
  selectedIndex,
  onQueryChange,
  onSelectedIndexChange,
  onNavigate,
  onClose
}: {
  query: string
  loading: boolean
  failed: boolean
  results: WikiSearchResult[]
  fallbackPages: WikiSearchResult[]
  selectedIndex: number
  onQueryChange: (value: string) => void
  onSelectedIndexChange: (index: number) => void
  onNavigate: (
    pageId: string,
    findTerm?: string,
    anchor?: string,
    source?: 'result' | 'quick-answer'
  ) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  const quickAnswer =
    query.trim() && !loading
      ? results.find(
          (result) =>
            result.status !== 'draft' &&
            Boolean(result.snippet?.trim()) &&
            Boolean(result.sectionTitle || result.findTerm)
        ) || null
      : null

  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR')
  const toolShortcut = !normalizedQuery
    ? null
    : /강화|곡괭이|인챈트|업글|장비/.test(normalizedQuery)
      ? {
          href: '/#enhancement-lab',
          icon: '⚒️',
          title: '강화 체험소에서 직접 해보기',
          description: '+15강까지 성공·실패·하락·파괴 흐름을 체험할 수 있어요.'
        }
      : /채광|광질|다야|다이아|광산/.test(normalizedQuery)
        ? {
            href: '/guide/mining/',
            icon: '⛏️',
            title: '채광 가이드 바로 보기',
            description: '채광과 초반 수익 흐름을 정리한 가이드로 이동합니다.'
          }
        : /뉴비|초보|처음|기초|입문/.test(normalizedQuery)
          ? {
              href: '/guide/newbie-guide/',
              icon: '🧭',
              title: '뉴비 필독부터 시작하기',
              description: '처음 접속했을 때 필요한 설정과 적응 순서를 확인합니다.'
            }
          : /faq|질문|규칙|가능|되나요|돼요/.test(normalizedQuery)
            ? {
                href: '/guide/faq/',
                icon: '❓',
                title: '자주 묻는 질문에서 빠르게 확인',
                description: '확인된 서버 규칙과 자주 묻는 답변을 먼저 찾아봅니다.'
              }
            : null

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => inputRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        onSelectedIndexChange(
          results.length ? (selectedIndex + 1) % results.length : 0
        )
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        onSelectedIndexChange(
          results.length
            ? (selectedIndex - 1 + results.length) % results.length
            : 0
        )
        return
      }

      if (event.key === 'Enter' && results[selectedIndex]) {
        event.preventDefault()
        onNavigate(
          results[selectedIndex].pageId,
          results[selectedIndex].findTerm,
          results[selectedIndex].anchor,
          'result'
        )
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'input, button, a[href], [tabindex]:not([tabindex="-1"])'
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
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [
    onClose,
    onNavigate,
    onSelectedIndexChange,
    results,
    selectedIndex
  ])

  return (
    <div
      className="search-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        ref={dialogRef}
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="위키 전체 검색"
      >
        <div className="search-modal-input" role="search">
          <span>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="규칙, 빚, 채광, 강화 등 무엇이든 검색하세요"
            aria-label="위키 전체 검색"
            aria-controls="wiki-search-results"
          />
          <button type="button" aria-label="검색 닫기" onClick={onClose}>
            ESC
          </button>
        </div>

        <div className="search-result-meta" aria-live="polite">
          {loading
            ? '본문 검색 색인을 불러오는 중…'
            : failed
              ? '본문 색인을 불러오지 못해 제목 검색으로 표시합니다.'
              : query.trim()
                ? `${results.length}개의 검색 결과`
                : '추천 문서 · ↑↓ 선택 · Enter 이동'}
        </div>

        {toolShortcut && (
          <Link
            href={withBasePath(toolShortcut.href)}
            className="search-tool-shortcut"
            onClick={onClose}
          >
            <span aria-hidden="true">{toolShortcut.icon}</span>
            <span>
              <strong>{toolShortcut.title}</strong>
              <small>{toolShortcut.description}</small>
            </span>
            <b aria-hidden="true">→</b>
          </Link>
        )}

        {quickAnswer && (
          <button
            type="button"
            className="search-quick-answer"
            onClick={() =>
              onNavigate(
                quickAnswer.pageId,
                quickAnswer.findTerm,
                quickAnswer.anchor,
                'quick-answer'
              )
            }
          >
            <span className="search-quick-answer-label">빠른 답변</span>
            <span className="search-quick-answer-source">
              <strong>{quickAnswer.title}</strong>
              {quickAnswer.sectionTitle && (
                <>
                  <b aria-hidden="true">›</b>
                  <span>{quickAnswer.sectionTitle}</span>
                </>
              )}
            </span>
            <span className="search-quick-answer-text">
              <HighlightedText
                text={quickAnswer.snippet || quickAnswer.sectionTitle || ''}
                query={query}
              />
            </span>
            <span className="search-quick-answer-action">
              원문 위치로 이동 <b aria-hidden="true">→</b>
            </span>
          </button>
        )}

        <div
          className="search-modal-results"
          id="wiki-search-results"
          role="listbox"
          aria-label="검색 결과"
        >
          {loading ? (
            <div className="search-loading-list" aria-label="검색 색인 불러오는 중">
              {Array.from({ length: 5 }).map((_, index) => (
                <span className="search-loading-row" key={index}>
                  <i />
                  <b />
                  <em />
                </span>
              ))}
            </div>
          ) : results.length ? (
            results.map((page, index) => {
              const search = page.findTerm
                ? `?find=${encodeURIComponent(page.findTerm)}`
                : ''
              const hash = page.anchor
                ? `#${encodeURIComponent(page.anchor)}`
                : ''
              return (
              <Link
                key={page.resultKey || `${page.pageId}:${page.anchor || 'page'}`}
                href={`${withBasePath(wikiGuidePath(page))}${search}${hash}`}
                prefetch={false}
                onClick={(event) => {
                  event.preventDefault()
                  onNavigate(page.pageId, page.findTerm, page.anchor, 'result')
                }}
                className={`search-result-card ${selectedIndex === index ? 'is-selected' : ''}`}
                data-category={page.category}
                role="option"
                aria-selected={selectedIndex === index}
                onMouseEnter={() => onSelectedIndexChange(index)}
              >
                <span className="search-result-icon">
                  {iconForTitle(page.title)}
                </span>
                <span>
                  <span className="search-result-meta-row">
                    <span className="search-result-category">{page.category}</span>
                    {page.status === 'draft' && (
                      <em className="search-draft-badge">작성 중</em>
                    )}
                    {page.status === 'brief' && (
                      <em className="search-brief-badge">간단 안내</em>
                    )}
                  </span>
                  <strong>
                    <HighlightedText text={page.title} query={query} />
                  </strong>
                  {page.sectionTitle && (
                    <span className="search-result-section">
                      <b aria-hidden="true">↳</b>
                      <HighlightedText text={page.sectionTitle} query={query} />
                    </span>
                  )}
                  <small>
                    {page.snippet ? (
                      <HighlightedText text={page.snippet} query={query} />
                    ) : (
                      '상세 가이드 열기'
                    )}
                  </small>
                </span>
                <b>↗</b>
              </Link>
              )
            })
          ) : (
            <div className="search-empty-state">
              <p className="search-empty">일치하는 문서를 찾지 못했습니다.</p>
              {fallbackPages.length > 0 && (
                <div className="search-fallback">
                  <span>대신 많이 찾는 문서를 확인해보세요.</span>
                  <div>
                    {fallbackPages.map((page) => (
                      <Link
                        key={page.pageId}
                        href={withBasePath(wikiGuidePath(page))}
                        onClick={onClose}
                      >
                        <span aria-hidden="true">{iconForTitle(page.title)}</span>
                        <strong>{page.title}</strong>
                        <b>→</b>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
