'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { withBasePath } from '@/lib/url-utils'

type TocItem = {
  id: string
  text: string
  level: number
}

type WikiPageLink = {
  pageId: string
  title: string
}

type SearchPage = WikiPageLink & {
  searchText?: string
}

const SEARCH_INDEX_URL =
  'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/notion-assets/search-index.json?v=20260925-2'

function sectionIcon(text: string) {
  const value = text.toLowerCase()

  if (value.includes('규칙') || value.includes('룰')) return '📜'
  if (value.includes('api') || value.includes('후원')) return '💝'
  if (value.includes('강화')) return '⚒️'
  if (value.includes('광산') || value.includes('채광')) return '⛏️'
  if (value.includes('낚시')) return '🎣'
  if (value.includes('사냥')) return '⚔️'
  if (value.includes('요리')) return '🍳'
  if (value.includes('도감')) return '📖'
  if (value.includes('카지노') || value.includes('가챠')) return '🎰'
  if (value.includes('패치') || value.includes('업데이트')) return '📝'
  if (value.includes('참여') || value.includes('접속')) return '📢'
  if (value.includes('아이템')) return '🎁'
  if (value.includes('안내') || value.includes('가이드')) return '🧭'

  return '✦'
}

function categoryLabel(title: string) {
  const value = title.toLowerCase()

  if (
    value.includes('스토리') ||
    value.includes('규칙') ||
    value.includes('패치') ||
    value.includes('api') ||
    value.includes('뉴비') ||
    value.includes('기초')
  ) {
    return '시작하기'
  }

  if (
    value.includes('땅') ||
    value.includes('빚') ||
    value.includes('신용') ||
    value.includes('수리') ||
    value.includes('강화') ||
    value.includes('물어보는')
  ) {
    return '성장 · 경제'
  }

  return '주요 콘텐츠'
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

export function WikiShell({
  children,
  sourceUrl,
  title,
  assetCount,
  pageCount,
  pages,
  brandLogo,
  heroImage,
  currentPageId,
  home = false
}: {
  children: React.ReactNode
  sourceUrl: string
  title: string
  assetCount: number
  pageCount: number
  pages: WikiPageLink[]
  brandLogo?: string | null
  heroImage?: string | null
  currentPageId?: string | null
  home?: boolean
}) {
  const router = useRouter()
  const [toc, setToc] = useState<TocItem[]>([])
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeTocId, setActiveTocId] = useState('')
  const [readingProgress, setReadingProgress] = useState(0)
  const [searchPages, setSearchPages] = useState<SearchPage[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [selectedResult, setSelectedResult] = useState(0)
  const modalSearchRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }

    const interval = window.setInterval(refreshIfVisible, 30_000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        window.setTimeout(() => router.refresh(), 120)
      }
    }

    window.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router]) // justserver-live-refresh

  useEffect(() => {
    const saved = window.localStorage.getItem('justserver3-theme')
    const nextTheme =
      saved === 'light' || saved === 'dark'
        ? saved
        : window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'

    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('justserver3-theme', theme)
  }, [theme])

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

  useEffect(() => {
    if (!toc.length) {
      setActiveTocId('')
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible[0]?.target.id) {
          setActiveTocId(visible[0].target.id)
        }
      },
      {
        rootMargin: '-18% 0px -68% 0px',
        threshold: [0, 1]
      }
    )

    for (const item of toc) {
      const element = document.getElementById(item.id)
      if (element) observer.observe(element)
    }

    return () => observer.disconnect()
  }, [toc])

  useEffect(() => {
    if (home) return

    let frame = 0

    const updateProgress = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const article = document.querySelector<HTMLElement>('.document-card')
        if (!article) return

        const rect = article.getBoundingClientRect()
        const start = window.scrollY + rect.top - 120
        const end =
          start +
          Math.max(article.offsetHeight - window.innerHeight * 0.42, 1)
        const value = Math.min(
          1,
          Math.max(0, (window.scrollY - start) / Math.max(end - start, 1))
        )

        setReadingProgress(Math.round(value * 100))
      })
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [home])

  const openSearch = () => {
    setSearchOpen(true)
    window.setTimeout(() => modalSearchRef.current?.focus(), 30)
  }

  useEffect(() => {
    if (!searchOpen || searchPages || searchLoading) return

    let cancelled = false

    const load = async () => {
      setSearchLoading(true)
      setSearchFailed(false)

      try {
        const response = await fetch(SEARCH_INDEX_URL, {
          cache: 'no-store'
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = (await response.json()) as {
          pages?: SearchPage[]
        }

        if (!cancelled) {
          setSearchPages(Array.isArray(data.pages) ? data.pages : [])
        }
      } catch {
        if (!cancelled) setSearchFailed(true)
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [searchOpen, searchPages, searchLoading])

  const filteredPages = useMemo(() => {
    const source: SearchPage[] =
      searchPages ?? pages.map((page) => ({ ...page, searchText: '' }))
    const keyword = query.trim().toLowerCase()

    if (!keyword) {
      return source.slice(0, 10).map((page) => ({ ...page, snippet: '' }))
    }

    return source
      .map((page) => {
        const title = page.title.toLowerCase()
        const searchText = page.searchText ?? ''
        const body = searchText.toLowerCase()
        const titleMatch = title.includes(keyword)
        const bodyIndex = body.indexOf(keyword)

        if (!titleMatch && bodyIndex < 0) return null

        let snippet = ''
        if (bodyIndex >= 0 && searchText) {
          const start = Math.max(0, bodyIndex - 56)
          const end = Math.min(
            searchText.length,
            bodyIndex + keyword.length + 88
          )
          snippet = `${start > 0 ? '…' : ''}${searchText
            .slice(start, end)
            .trim()}${end < searchText.length ? '…' : ''}`
        }

        return { ...page, snippet }
      })
      .filter(
        (
          page
        ): page is SearchPage & {
          snippet: string
        } => Boolean(page)
      )
      .slice(0, 14)
  }, [pages, query, searchPages])

  useEffect(() => {
    setSelectedResult(0)
  }, [query, filteredPages.length])

  useEffect(() => {
    if (!searchOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedResult((value) =>
          filteredPages.length ? (value + 1) % filteredPages.length : 0
        )
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedResult((value) =>
          filteredPages.length
            ? (value - 1 + filteredPages.length) % filteredPages.length
            : 0
        )
      }

      if (event.key === 'Enter' && filteredPages[selectedResult]) {
        event.preventDefault()
        window.location.assign(
          withBasePath(`/page/${filteredPages[selectedResult].pageId}/`)
        )
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
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
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [filteredPages, searchOpen, selectedResult])

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
        openSearch()
      }

      if (event.key === 'Escape') {
        setSearchOpen(false)
        setQuery('')
        modalSearchRef.current?.blur()
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
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>

      <header className="wiki-topbar">
        <button
          className="menu-button"
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setMenuOpen((value) => !value)}
        >
          ☰
        </button>

        <a className="brand" href={withBasePath('/')}>
          <span className="brand-mark brand-image-mark">
            {brandLogo ? (
              <img
                className="brand-logo-image"
                src={brandLogo}
                alt=""
                aria-hidden="true"
                width="54"
                height="54"
                decoding="async"
              />
            ) : (
              <span>적</span>
            )}
          </span>
          <span>
            <strong>{home ? '그냥서버 : 적자생존' : title}</strong>
            <small>OFFICIAL WIKI</small>
          </span>
        </a>

        <div className="top-actions">
          <button
            className="header-search-button"
            type="button"
            aria-keyshortcuts="Control+K Meta+K /"
            onClick={openSearch}
          >
            <span>⌕</span>
            <span>문서 검색</span>
            <kbd>Ctrl K</kbd>
          </button>

          <button
            className="theme-toggle"
            type="button"
            aria-pressed={theme === 'light'}
            aria-label={
              theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'
            }
            onClick={() =>
              setTheme((value) => (value === 'dark' ? 'light' : 'dark'))
            }
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Notion ↗
          </a>
        </div>
      </header>

      <aside className={`wiki-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <strong>문서 탐색</strong>
          <span>{pages.length}개</span>
        </div>

        <button
          className="wiki-search wiki-search-trigger"
          type="button"
          aria-keyshortcuts="Control+K Meta+K /"
          onClick={openSearch}
        >
          <span>⌕</span>
          <span>전체 문서 검색</span>
          <kbd>⌘K</kbd>
        </button>

        <div className="sidebar-primary-links">
          <a className="sidebar-home" href={withBasePath('/')}>
            <span>🏠</span>
            위키 홈
          </a>
          <a
            className="sidebar-home sidebar-status-link"
            href={withBasePath('/status/')}
          >
            <span>●</span>
            위키 상태
          </a>
        </div>

        <nav className="toc-list">
          <div className="global-page-list">
            <span className="nav-section-label">전체 문서</span>
            {pages.map((page) => (
              <a
                key={page.pageId}
                href={withBasePath(`/page/${page.pageId}/`)}
                className={`global-page-link ${
                  currentPageId &&
                  page.pageId.replaceAll('-', '') ===
                    currentPageId.replaceAll('-', '')
                    ? 'is-current'
                    : ''
                }`}
                aria-current={
                  currentPageId &&
                  page.pageId.replaceAll('-', '') ===
                    currentPageId.replaceAll('-', '')
                    ? 'page'
                    : undefined
                }
              >
                <span>{sectionIcon(page.title)}</span>
                <span className="global-page-copy">
                  <strong>{page.title}</strong>
                </span>
              </a>
            ))}
          </div>

          <div className="current-toc mobile-current-toc">
            <span className="nav-section-label">현재 페이지</span>
            {toc.length ? (
              toc.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`toc-item level-${item.level} ${
                    activeTocId === item.id ? 'is-active' : ''
                  }`}
                  aria-current={activeTocId === item.id ? 'location' : undefined}
                  onClick={() => goTo(item.id)}
                >
                  <span>{sectionIcon(item.text)}</span>
                  <span>{item.text}</span>
                </button>
              ))
            ) : (
              <p className="toc-empty">현재 페이지 목차가 없습니다.</p>
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

      {!home && toc.length > 0 && (
        <aside className="article-toc" aria-label="현재 문서 목차">
          <div className="article-progress">
            <span>읽는 중</span>
            <strong>{readingProgress}%</strong>
          </div>
          <div className="article-progress-track" aria-hidden="true">
            <span style={{ height: `${readingProgress}%` }} />
          </div>
          <span className="article-toc-label">이 페이지에서</span>
          <nav>
            {toc.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`article-toc-item level-${item.level} ${
                  activeTocId === item.id ? 'is-active' : ''
                }`}
                aria-current={activeTocId === item.id ? 'location' : undefined}
                onClick={() => goTo(item.id)}
              >
                {item.text}
              </button>
            ))}
          </nav>
        </aside>
      )}

      <main
        className={`wiki-main ${!home && toc.length ? 'has-article-toc' : ''}`}
        id="main-content"
      >
        <section
          className={`wiki-hero ${home ? 'is-home' : 'is-article'} ${heroImage ? 'has-hero-image' : ''}`}
          aria-label="위키 안내"
        >
          {heroImage && home && (
            <div
              className="hero-background-image"
              style={{ backgroundImage: `url("${heroImage}")` }}
              aria-hidden="true"
            />
          )}
          <div className="hero-overlay" aria-hidden="true" />

          {home && (
            <div className="hero-badges">
              <span className="hero-badge primary">공식 위키</span>
              <span className="hero-badge">🧭 뉴비 필독</span>
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
                ? '서버 규칙부터 돈벌이, 콘텐츠, 장비 성장까지 적자생존에 필요한 정보를 한곳에서 빠르게 찾아보세요.'
                : '왼쪽 문서 목록과 오른쪽 목차를 이용해 필요한 내용을 빠르게 찾아보세요.'}
            </p>
            {home && (
              <button
                className="hero-search-cta"
                type="button"
                aria-keyshortcuts="Control+K Meta+K /"
                onClick={openSearch}
              >
                <span>⌕</span>
                <span>가이드, 콘텐츠, 아이템을 검색하세요</span>
                <kbd>Ctrl K</kbd>
              </button>
            )}
          </div>
        </section>

        {children}

        <footer className="wiki-footer">
          <div>
            <strong>{home ? '그냥서버 : 적자생존 공식 위키' : title}</strong>
            <span>서버 규칙과 플레이 가이드를 한곳에서 확인하세요.</span>
          </div>
          <nav className="footer-links">
            <a href={withBasePath('/status/')}>위키 상태</a>
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              원본 문서 ↗
            </a>
          </nav>
        </footer>
      </main>

      {searchOpen && (
        <div
          className="search-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSearchOpen(false)
          }}
        >
          <section
            ref={modalRef}
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="위키 전체 검색"
          >
            <div className="search-modal-input" role="search">
              <span>⌕</span>
              <input
                ref={modalSearchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="규칙, 빚, 채광, 강화 등 무엇이든 검색하세요"
                aria-label="위키 전체 검색"
                aria-controls="wiki-search-results"
              />
              <button
                type="button"
                aria-label="검색 닫기"
                onClick={() => setSearchOpen(false)}
              >
                ESC
              </button>
            </div>

            <div className="search-result-meta" aria-live="polite">
              {searchLoading
                ? '본문 검색 색인을 불러오는 중…'
                : searchFailed
                  ? '본문 색인을 불러오지 못해 제목 검색으로 표시합니다.'
                  : query.trim()
                    ? `${filteredPages.length}개의 검색 결과`
                    : '추천 문서 · ↑↓ 선택 · Enter 이동'}
            </div>

            <div
              className="search-modal-results"
              id="wiki-search-results"
              role="listbox"
              aria-label="검색 결과"
            >
              {filteredPages.length ? (
                filteredPages.map((page, index) => (
                  <a
                    key={page.pageId}
                    href={withBasePath(`/page/${page.pageId}/`)}
                    className={`search-result-card ${
                      selectedResult === index ? 'is-selected' : ''
                    }`}
                    role="option"
                    aria-selected={selectedResult === index}
                    onMouseEnter={() => setSelectedResult(index)}
                  >
                    <span className="search-result-icon">
                      {sectionIcon(page.title)}
                    </span>
                    <span>
                      <span className="search-result-category">
                        {categoryLabel(page.title)}
                      </span>
                      <strong>
                        <HighlightedText text={page.title} query={query} />
                      </strong>
                      <small>
                        {page.snippet ? (
                          <HighlightedText text={page.snippet} query={query} />
                        ) : (
                          '상세 가이드 열기'
                        )}
                      </small>
                    </span>
                    <b>↗</b>
                  </a>
                ))
              ) : (
                <p className="search-empty">
                  일치하는 문서가 없습니다. 다른 검색어를 입력해보세요.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
