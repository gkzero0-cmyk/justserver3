'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { withBasePath } from '@/lib/base-path'

type TocItem = {
  id: string
  text: string
  level: number
}

type WikiPageLink = {
  pageId: string
  title: string
  searchText?: string
}

function sectionIcon(text: string) {
  const value = text.toLowerCase()

  if (value.includes('규칙') || value.includes('룰')) return '📜'
  if (value.includes('api') || value.includes('후원')) return '💝'
  if (value.includes('강화')) return '⚒️'
  if (value.includes('광산') || value.includes('채광')) return '⛏️'
  if (value.includes('가챠')) return '🎰'
  if (value.includes('던전')) return '⚔️'
  if (value.includes('패치') || value.includes('업데이트')) return '📝'
  if (value.includes('참여') || value.includes('접속')) return '📢'
  if (value.includes('도감')) return '📖'
  if (value.includes('아이템')) return '🎁'
  if (value.includes('안내') || value.includes('가이드')) return '🧭'

  return '✦'
}

export function WikiShell({
  children,
  sourceUrl,
  title,
  assetCount,
  pageCount,
  pages,
  home = false
}: {
  children: React.ReactNode
  sourceUrl: string
  title: string
  assetCount: number
  pageCount: number
  pages: WikiPageLink[]
  home?: boolean
}) {
  const [toc, setToc] = useState<TocItem[]>([])
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.notion-page-content h1, .notion-page-content h2, .notion-page-content h3'
        )
      )

      const next = nodes
        .map((node, index) => {
          const text = node.textContent?.trim() ?? ''
          if (!text) return null
          if (!node.id) node.id = `section-${index + 1}`
          const level = Number(node.tagName.slice(1))
          return { id: node.id, text, level }
        })
        .filter((item): item is TocItem => Boolean(item))

      setToc(next)
    }, 450)

    return () => window.clearTimeout(timer)
  }, [children])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return toc
    return toc.filter((item) => item.text.toLowerCase().includes(keyword))
  }, [query, toc])

  const filteredPages = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    if (!keyword) {
      return pages.slice(0, 8).map((page) => ({ ...page, snippet: '' }))
    }

    return pages
      .map((page) => {
        const title = page.title.toLowerCase()
        const body = (page.searchText ?? '').toLowerCase()
        const titleMatch = title.includes(keyword)
        const bodyIndex = body.indexOf(keyword)

        if (!titleMatch && bodyIndex < 0) return null

        let snippet = ''
        if (bodyIndex >= 0 && page.searchText) {
          const start = Math.max(0, bodyIndex - 48)
          const end = Math.min(page.searchText.length, bodyIndex + keyword.length + 72)
          snippet = `${start > 0 ? '…' : ''}${page.searchText
            .slice(start, end)
            .trim()}${end < page.searchText.length ? '…' : ''}`
        }

        return { ...page, snippet }
      })
      .filter(
        (
          page
        ): page is WikiPageLink & {
          snippet: string
        } => Boolean(page)
      )
      .slice(0, 12)
  }, [pages, query])

  const quickLinks = useMemo(() => {
    const primary = toc.filter((item) => item.level <= 2)
    return (primary.length ? primary : toc).slice(0, 9)
  }, [toc])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (
        (event.key === '/' && !isTyping) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
      ) {
        event.preventDefault()
        setMenuOpen(true)
        window.setTimeout(() => searchInputRef.current?.focus(), 30)
      }

      if (event.key === 'Escape') {
        searchInputRef.current?.blur()
        setQuery('')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
    setMenuOpen(false)
  }

  return (
    <div className="wiki-shell">
      <header className="wiki-topbar">
        <button
          className="menu-button"
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setMenuOpen((value) => !value)}
        >
          ☰
        </button>

        <a className="brand" href={withBasePath("/")}>
          <span className="brand-mark">W</span>
          <span>
            <strong>{title}</strong>
            <small>OFFICIAL SERVER GUIDE</small>
          </span>
        </a>

        <div className="top-actions">
          <span className="sync-chip">
            <span className="live-dot" />
            최신 가이드
          </span>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            원본 Notion ↗
          </a>
        </div>
      </header>

      <aside className={`wiki-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <strong>문서 탐색</strong>
          <span>{toc.length}개 항목</span>
        </div>

        <label className="wiki-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="규칙, API, 강화 검색"
            aria-label="전체 문서 및 목차 검색"
            ref={searchInputRef}
          />
          <kbd>⌘K</kbd>
        </label>

        <div className="sidebar-primary-links">
          <a className="sidebar-home" href={withBasePath("/")}>
            <span>🏠</span>
            위키 홈
          </a>
          <a className="sidebar-home sidebar-status-link" href={withBasePath("/status/")}>
            <span>●</span>
            위키 상태
          </a>
        </div>

        <nav className="toc-list">
          {filteredPages.length > 0 && (
            <div className="global-page-list">
              <span className="nav-section-label">전체 문서</span>
              {filteredPages.map((page) => (
                <a
                  key={page.pageId}
                  href={withBasePath(`/page/${page.pageId}/`)}
                  className="global-page-link"
                >
                  <span>{sectionIcon(page.title)}</span>
                  <span className="global-page-copy">
                    <strong>{page.title}</strong>
                    {page.snippet && <small>{page.snippet}</small>}
                  </span>
                </a>
              ))}
            </div>
          )}

          <div className="current-toc">
            <span className="nav-section-label">현재 페이지</span>
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`toc-item level-${item.level}`}
                  onClick={() => goTo(item.id)}
                >
                  <span>{sectionIcon(item.text)}</span>
                  <span>{item.text}</span>
                </button>
              ))
            ) : (
              <p className="toc-empty">일치하는 목차가 없습니다.</p>
            )}
          </div>
        </nav>

        <div className="sidebar-foot">
          <span className="live-dot" />
          공식 가이드 문서
        </div>
      </aside>

      {menuOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="wiki-main">
        <section
          className={`wiki-hero ${home ? 'is-home' : 'is-article'}`}
          aria-label="위키 안내"
        >
          {home && (
            <div className="hero-badges">
              <span className="hero-badge primary">공식 가이드</span>
              <span className="hero-badge">🧭 뉴비 필독 가이드</span>
              <span className="hero-badge">📚 문서 {pageCount}개</span>
            </div>
          )}

          <div className="hero-copy">
            <p className="hero-kicker">
              {home ? 'JUST SERVER · SURVIVAL WIKI' : 'WIKI DOCUMENT'}
            </p>
            <h1>{title}</h1>
            <p>
              {home
                ? '서버 규칙부터 돈벌이, 콘텐츠, 장비 성장까지 필요한 정보를 빠르게 찾을 수 있습니다. 검색창에서 문서 제목뿐 아니라 본문 내용도 바로 검색할 수 있습니다.'
                : '왼쪽 검색과 목차를 이용해 필요한 내용을 빠르게 찾아보세요.'}
            </p>
          </div>

          {quickLinks.length > 0 && (
            <div className="quick-nav" aria-label="주요 항목 바로가기">
              {quickLinks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="quick-nav-card"
                  onClick={() => goTo(item.id)}
                >
                  <span className="quick-nav-icon">{sectionIcon(item.text)}</span>
                  <span className="quick-nav-label">{item.text}</span>
                  <span className="quick-nav-arrow">→</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {children}

        <footer className="wiki-footer">
          <div>
            <strong>{title}</strong>
            <span>서버 규칙과 플레이 가이드를 한곳에서 확인하세요.</span>
          </div>
          <nav className="footer-links">
            <a href={withBasePath("/status/")}>위키 상태</a>
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              원본 문서 보기 ↗
            </a>
          </nav>
        </footer>
      </main>
    </div>
  )
}
