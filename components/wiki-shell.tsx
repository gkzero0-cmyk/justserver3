'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { categoryTitleForPage, iconForTitle } from '@/lib/wiki-taxonomy'
import {
  matchesKoreanInitials,
  updateRecentPageIds
} from '@/lib/wiki-ux'
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

const SEARCH_INDEX_URL = withBasePath(
  '/api/notion-webhook?resource=search-index'
)
const RECENT_PAGES_KEY = 'justserver3-recent-pages-v1'

function sectionIcon(text: string) {
  return iconForTitle(text)
}

function categoryLabel(title: string) {
  return categoryTitleForPage(title)
}

const SEARCH_PRIORITY = [
  '서버규칙',
  '기초설정(뉴비필독)',
  '채광',
  '스토리',
  'API',
  '요리',
  '사냥',
  '땅 구매'
]

const SEARCH_ALIASES: Record<string, string[]> = {
  초보: ['뉴비', '기초'],
  뉴비: ['초보', '기초'],
  돈: ['경제', '빚', '채광'],
  돈벌이: ['채광', '경제'],
  광질: ['채광'],
  강화석: ['강화'],
  장비: ['강화', '수리'],
  룰: ['규칙'],
  규정: ['규칙'],
  질문: ['많이 물어보는 것', 'faq']
}

function isDraftSearchPage(page: SearchPage) {
  const text = (page.searchText || '').replace(/\s+/g, ' ').trim()
  return Boolean(text) && (
    /위키\s*업데이트\s*예정|내용\s*추가\s*예정|작성\s*중/i.test(text) ||
    text.length < 80
  )
}

function editDistance(left: string, right: string) {
  const a = [...left]
  const b = [...right]
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      previous = saved
    }
  }

  return row[b.length]
}

function expandedSearchTerms(keyword: string) {
  const terms = new Set([keyword])
  for (const [alias, values] of Object.entries(SEARCH_ALIASES)) {
    if (keyword.includes(alias) || alias.includes(keyword)) {
      for (const value of values) terms.add(value.toLowerCase())
    }
  }
  return [...terms].filter(Boolean)
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
  pageCount,
  pages,
  brandLogo,
  heroImage,
  heroImageMd,
  heroImageSm,
  currentPageId,
  home = false
}: {
  children: React.ReactNode
  sourceUrl: string
  title: string
  pageCount: number
  pages: WikiPageLink[]
  brandLogo?: string | null
  heroImage?: string | null
  heroImageMd?: string | null
  heroImageSm?: string | null
  currentPageId?: string | null
  home?: boolean
}) {
  const router = useRouter()
  const [toc, setToc] = useState<TocItem[]>([])
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const [openMobileCategories, setOpenMobileCategories] = useState<string[]>([])
  const [recentPageIds, setRecentPageIds] = useState<string[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
    const saved = window.localStorage.getItem('justserver3-sidebar-collapsed')
    const collapsed = saved === 'true'
    setSidebarCollapsed(collapsed)
    document.documentElement.dataset.sidebar = collapsed
      ? 'collapsed'
      : 'expanded'
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed((value) => {
      const next = !value
      window.localStorage.setItem(
        'justserver3-sidebar-collapsed',
        String(next)
      )
      document.documentElement.dataset.sidebar = next
        ? 'collapsed'
        : 'expanded'
      return next
    })
  }

  const currentCategory = useMemo(() => {
    const current = pages.find(
      (page) =>
        currentPageId &&
        page.pageId.replaceAll('-', '') === currentPageId.replaceAll('-', '')
    )
    return current ? categoryLabel(current.title) : '시작하기'
  }, [currentPageId, pages])

  useEffect(() => {
    setOpenMobileCategories([currentCategory])
  }, [currentCategory])

  useEffect(() => {
    let stored: string[] = []
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(RECENT_PAGES_KEY) || '[]'
      )
      stored = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : []
    } catch {}

    const next = currentPageId
      ? updateRecentPageIds(stored, currentPageId, 5)
      : stored.slice(0, 5)

    setRecentPageIds(next)

    if (currentPageId) {
      window.localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next))
    }
  }, [currentPageId])

  const recentPages = useMemo(
    () =>
      recentPageIds
        .map((pageId) =>
          pages.find(
            (page) =>
              page.pageId.replaceAll('-', '') === pageId.replaceAll('-', '')
          )
        )
        .filter((page): page is WikiPageLink => Boolean(page))
        .slice(0, 5),
    [pages, recentPageIds]
  )

  const toggleMobileCategory = (category: string) => {
    setOpenMobileCategories((value) =>
      value.includes(category)
        ? value.filter((item) => item !== category)
        : [...value, category]
    )
  }

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
        const response = await fetch(SEARCH_INDEX_URL)
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
    const terms = expandedSearchTerms(keyword)

    const priorityOf = (page: SearchPage) => {
      const index = SEARCH_PRIORITY.indexOf(page.title)
      return index >= 0 ? index : 100
    }

    if (!keyword) {
      return [...source]
        .sort((a, b) => {
          const draftDiff =
            Number(isDraftSearchPage(a)) - Number(isDraftSearchPage(b))
          if (draftDiff) return draftDiff
          return priorityOf(a) - priorityOf(b)
        })
        .slice(0, 10)
        .map((page) => ({ ...page, snippet: '' }))
    }

    return source
      .map((page) => {
        const title = page.title.toLowerCase()
        const searchText = page.searchText ?? ''
        const body = searchText.toLowerCase()
        const matchingTerm =
          terms.find((term) => title.includes(term) || body.includes(term)) ||
          null
        const initialMatch = matchesKoreanInitials(page.title, keyword)
        const fuzzyTitleMatch =
          keyword.length >= 3 &&
          title
            .split(/[\s()·:_-]+/)
            .filter(Boolean)
            .some(
              (word) =>
                Math.abs(word.length - keyword.length) <= 1 &&
                editDistance(word, keyword) <= 1
            )

        if (!matchingTerm && !initialMatch && !fuzzyTitleMatch) return null

        const bodyIndex = matchingTerm ? body.indexOf(matchingTerm) : -1
        let snippet = ''
        if (bodyIndex >= 0 && searchText) {
          const start = Math.max(0, bodyIndex - 56)
          const end = Math.min(
            searchText.length,
            bodyIndex + (matchingTerm?.length || keyword.length) + 88
          )
          snippet = `${start > 0 ? '…' : ''}${searchText
            .slice(start, end)
            .trim()}${end < searchText.length ? '…' : ''}`
        }

        const titleExact = title === keyword
        const titleMatch = terms.some((term) => title.includes(term))
        const score =
          (isDraftSearchPage(page) ? 1000 : 0) +
          (titleExact
            ? 0
            : titleMatch
              ? 10
              : initialMatch
                ? 15
                : fuzzyTitleMatch
                  ? 20
                  : 40) +
          priorityOf(page)

        return { ...page, snippet, score }
      })
      .filter(
        (
          page
        ): page is SearchPage & {
          snippet: string
          score: number
        } => Boolean(page)
      )
      .sort((a, b) => a.score - b.score)
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
        router.push(
          withBasePath(`/page/${filteredPages[selectedResult].pageId}/`)
        )
        setSearchOpen(false)
        setQuery('')
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
  }, [filteredPages, router, searchOpen, selectedResult])

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
        setMobileTocOpen(false)
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
    setMobileTocOpen(false)
  }

  useEffect(() => {
    if (!mobileTocOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileTocOpen])

  return (
    <div className={`wiki-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
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

        <Link className="brand" href={withBasePath('/')} prefetch={false}>
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
        </Link>

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

        </div>
      </header>

      <aside className={`wiki-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <strong>문서 탐색</strong>
          <span>{pages.length}개</span>
        </div>

        {!home && (
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
        )}

        <div className="sidebar-primary-links">
          <Link className="sidebar-home" href={withBasePath('/')} prefetch={false} onClick={() => setMenuOpen(false)}>
            <span>🏠</span>
            위키 홈
          </Link>
        </div>

        <nav className="toc-list">
          <div className="global-page-list">
            <span className="nav-section-label">전체 문서</span>
            {['시작하기', '주요 콘텐츠', '성장 · 경제'].map((group) => {
              const groupPages = pages.filter(
                (page) => categoryLabel(page.title) === group
              )

              if (!groupPages.length) return null

              return (
                <section
                  className={`sidebar-category ${openMobileCategories.includes(group) ? 'is-mobile-open' : ''}`}
                  key={group}
                >
                  <button
                    type="button"
                    className="sidebar-category-head"
                    aria-expanded={openMobileCategories.includes(group)}
                    onClick={() => toggleMobileCategory(group)}
                  >
                    <strong>{group}</strong>
                    <span className="sidebar-category-meta">
                      <span>{groupPages.length}</span>
                      <b aria-hidden="true">⌄</b>
                    </span>
                  </button>
                  <div className="sidebar-category-links">
                    {groupPages.map((page) => (
                      <Link
                        key={page.pageId}
                        href={withBasePath(`/page/${page.pageId}/`)}
                        prefetch={false}
                        onClick={() => setMenuOpen(false)}
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
                        <span className="sidebar-page-icon" aria-hidden="true">
                          {sectionIcon(page.title)}
                        </span>
                        <span className="global-page-copy">
                          <strong>{page.title}</strong>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
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

      <button
        className="sidebar-edge-toggle"
        type="button"
        aria-label={sidebarCollapsed ? '문서 목록 펼치기' : '문서 목록 접기'}
        aria-pressed={sidebarCollapsed}
        title={sidebarCollapsed ? '문서 목록 펼치기' : '문서 목록 접기'}
        onClick={toggleSidebar}
      >
        <span className="sidebar-toggle-expanded" aria-hidden="true">‹</span>
        <span className="sidebar-toggle-collapsed" aria-hidden="true">
          <b>☰</b><em>문서</em>
        </span>
      </button>

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
            <picture className="hero-background-image" aria-hidden="true">
              {heroImageSm && (
                <source media="(max-width: 640px)" srcSet={heroImageSm} />
              )}
              {heroImageMd && (
                <source media="(max-width: 1280px)" srcSet={heroImageMd} />
              )}
              <img
                src={heroImage}
                alt=""
                width="1600"
                height="900"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
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
            {home && (
              <p>
                서버 규칙부터 돈벌이, 콘텐츠, 장비 성장까지 적자생존에 필요한 정보를 한곳에서 빠르게 찾아보세요.
              </p>
            )}
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

        {home && recentPages.length > 0 && (
          <section className="recent-viewed" aria-labelledby="recent-viewed-title">
            <div className="recent-viewed-head">
              <div>
                <p>RECENTLY VIEWED</p>
                <h2 id="recent-viewed-title">최근 본 문서</h2>
              </div>
              <small>이 브라우저에만 저장됩니다.</small>
            </div>
            <div className="recent-viewed-list">
              {recentPages.map((page) => (
                <Link
                  key={page.pageId}
                  href={withBasePath(`/page/${page.pageId}/`)}
                  className="recent-viewed-card"
                >
                  <span aria-hidden="true">{sectionIcon(page.title)}</span>
                  <strong>{page.title}</strong>
                  <b>→</b>
                </Link>
              ))}
            </div>
          </section>
        )}

        {children}

        <footer className="wiki-footer">
          <div>
            <strong>{home ? '그냥서버 : 적자생존 공식 위키' : title}</strong>
            <span>서버 규칙과 플레이 가이드를 한곳에서 확인하세요.</span>
          </div>
          <nav className="footer-links">
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              원본 문서 ↗
            </a>
          </nav>
        </footer>
      </main>

      {!home && (
        <div className={`mobile-reading-tools ${readingProgress > 2 ? 'is-visible' : ''}`}>
          {toc.length > 0 && (
            <button type="button" onClick={() => setMobileTocOpen(true)} aria-label="현재 문서 목차 열기">
              ☷ <span>목차</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="페이지 맨 위로 이동"
          >
            ↑ <span>위로</span>
          </button>
        </div>
      )}

      {mobileTocOpen && (
        <div
          className="mobile-toc-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setMobileTocOpen(false)
          }}
        >
          <section
            className="mobile-toc-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="현재 문서 목차"
          >
            <div className="mobile-toc-handle" aria-hidden="true" />
            <header>
              <div>
                <small>현재 문서</small>
                <strong>목차</strong>
              </div>
              <button
                type="button"
                aria-label="목차 닫기"
                onClick={() => setMobileTocOpen(false)}
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
                  onClick={() => goTo(item.id)}
                >
                  <span>{sectionIcon(item.text)}</span>
                  <strong>{item.text}</strong>
                </button>
              ))}
            </nav>
          </section>
        </div>
      )}

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
              {searchLoading && !searchPages && !searchFailed ? (
                <div className="search-loading-list" aria-label="검색 색인 불러오는 중">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span className="search-loading-row" key={index}>
                      <i />
                      <b />
                      <em />
                    </span>
                  ))}
                </div>
              ) : filteredPages.length ? (
                filteredPages.map((page, index) => (
                  <Link
                    key={page.pageId}
                    href={withBasePath(`/page/${page.pageId}/`)}
                    prefetch={false}
                    onClick={() => {
                      setSearchOpen(false)
                      setQuery('')
                    }}
                    className={`search-result-card ${
                      selectedResult === index ? 'is-selected' : ''
                    }`}
                    data-category={categoryLabel(page.title)}
                    role="option"
                    aria-selected={selectedResult === index}
                    onMouseEnter={() => setSelectedResult(index)}
                  >
                    <span className="search-result-icon">
                      {sectionIcon(page.title)}
                    </span>
                    <span>
                      <span className="search-result-meta-row">
                        <span className="search-result-category">
                          {categoryLabel(page.title)}
                        </span>
                        {isDraftSearchPage(page) && (
                          <em className="search-draft-badge">작성 중</em>
                        )}
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
                  </Link>
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
