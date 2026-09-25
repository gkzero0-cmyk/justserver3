'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  MobileTocSheet,
  RecentViewedSection,
  type ReadingTocItem
} from '@/components/wiki-reading-widgets'
import {
  WikiNavigation,
  type WikiNavigationPage
} from '@/components/wiki-navigation'
import {
  WikiSearchDialog,
  type WikiSearchResult
} from '@/components/wiki-search-dialog'
import {
  WikiAchievementNotifier,
  WikiTreasureFind
} from '@/components/wiki-survival-widgets'
import { categoryTitleForPage } from '@/lib/wiki-taxonomy'
import {
  normalizeSurvivalRecord,
  recordSurvivalActivity,
  recordSurvivalDay,
  seoulDateKey
} from '@/lib/wiki-survival'
import {
  classifyWikiContent,
  matchesKoreanInitials,
  suggestFallbackPages,
  updateRecentPageIds,
  wikiHeadingId,
  type WikiContentStatus
} from '@/lib/wiki-ux'
import { withBasePath } from '@/lib/url-utils'

type TocItem = ReadingTocItem

type WikiPageLink = WikiNavigationPage & {
  status?: WikiContentStatus
}

type SearchPage = WikiPageLink & {
  searchText?: string
}

type SearchIndexPayload = {
  generatedAt?: string
  pages?: SearchPage[]
}

let clientSearchIndexCache: SearchIndexPayload | null = null
let clientSearchIndexCachedAt = 0

const SEARCH_INDEX_URLS = [
  withBasePath('/notion-assets/search-index.json'),
  withBasePath('/api/notion-webhook?resource=search-index')
]
const CORE_PREFETCH_TITLES = new Set([
  '서버규칙',
  '기초설정(뉴비필독)',
  '채광'
])
const RECENT_PAGES_KEY = 'justserver3-recent-pages-v1'
const VISITED_PAGES_KEY = 'justserver3-visited-pages-v1'
const SURVIVAL_RECORD_KEY = 'justserver3-survival-record-v1'

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

function searchPageStatus(page: SearchPage) {
  if (page.status) return page.status
  const text = (page.searchText || '').replace(/\s+/g, ' ').trim()
  return text ? classifyWikiContent(page) : null
}

function pageCategoryLabel(page: WikiPageLink) {
  return page.category || categoryLabel(page.title)
}

function isDraftSearchPage(page: SearchPage) {
  return searchPageStatus(page) === 'draft'
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
  contentStatus,
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
  contentStatus?: WikiContentStatus
  home?: boolean
}) {
  const router = useRouter()
  const [toc, setToc] = useState<TocItem[]>([])
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const [openMobileCategories, setOpenMobileCategories] = useState<string[]>([])
  const [recentPageIds, setRecentPageIds] = useState<string[]>([])
  const [recentReady, setRecentReady] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [activeTocId, setActiveTocId] = useState('')
  const [readingProgress, setReadingProgress] = useState(0)
  const [searchPages, setSearchPages] = useState<SearchPage[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [selectedResult, setSelectedResult] = useState(0)
  const handledHashRef = useRef('')
  const zeroSearchTrackedRef = useRef('')
  const searchRefreshAtRef = useRef(0)

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
    return current ? pageCategoryLabel(current) : '시작하기'
  }, [currentPageId, pages])

  useEffect(() => {
    setOpenMobileCategories([currentCategory])
  }, [currentCategory])

  useEffect(() => {
    let record
    try {
      record = normalizeSurvivalRecord(
        JSON.parse(
          window.localStorage.getItem(SURVIVAL_RECORD_KEY) || 'null'
        )
      )
    } catch {
      record = normalizeSurvivalRecord(null)
    }

    const next = recordSurvivalDay(record, seoulDateKey())
    window.localStorage.setItem(
      SURVIVAL_RECORD_KEY,
      JSON.stringify(next)
    )
    window.dispatchEvent(new Event('justserver3:survival-record'))
  }, [])

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
    setRecentReady(true)

    if (currentPageId) {
      window.localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next))

      let visited: string[] = []
      try {
        const parsed = JSON.parse(
          window.localStorage.getItem(VISITED_PAGES_KEY) || '[]'
        )
        visited = Array.isArray(parsed)
          ? parsed.filter(
              (value): value is string => typeof value === 'string'
            )
          : []
      } catch {}

      const nextVisited = updateRecentPageIds(
        visited,
        currentPageId,
        Math.max(pages.length, 1)
      )
      window.localStorage.setItem(
        VISITED_PAGES_KEY,
        JSON.stringify(nextVisited)
      )
      window.dispatchEvent(new Event('justserver3:visited-pages'))

      let record
      try {
        record = normalizeSurvivalRecord(
          JSON.parse(
            window.localStorage.getItem(SURVIVAL_RECORD_KEY) || 'null'
          )
        )
      } catch {
        record = normalizeSurvivalRecord(null)
      }

      const nextRecord = recordSurvivalActivity(
        record,
        seoulDateKey(),
        'visit',
        currentPageId
      )
      window.localStorage.setItem(
        SURVIVAL_RECORD_KEY,
        JSON.stringify(nextRecord)
      )
      window.dispatchEvent(new Event('justserver3:survival-record'))
    }
  }, [currentPageId, pages.length])

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

  const clearRecentPages = () => {
    window.localStorage.removeItem(RECENT_PAGES_KEY)
    setRecentPageIds([])
    setRecentReady(true)
    track('wiki_recent_history_clear')
  }

  const toggleMobileCategory = (category: string) => {
    setOpenMobileCategories((value) =>
      value.includes(category)
        ? value.filter((item) => item !== category)
        : [...value, category]
    )
  }

  useEffect(() => {
    if (home) {
      setToc([])
      return
    }

    const root = document.getElementById('main-content')
    if (!root) return

    let frame = 0

    const collectHeadings = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.notion-page-content h1, .notion-page-content h2, .notion-page-content h3'
          )
        )
        const occurrences = new Map<string, number>()

        const next = nodes
          .map((node) => {
            const rawText =
              Array.from(node.childNodes)
                .filter(
                  (child) =>
                    !(child instanceof HTMLElement) ||
                    !child.classList.contains('heading-anchor-copy')
                )
                .map((child) => child.textContent || '')
                .join('')
                .trim()

            if (!rawText) return null

            const baseId = wikiHeadingId(rawText)
            const occurrence = (occurrences.get(baseId) || 0) + 1
            occurrences.set(baseId, occurrence)
            const id = wikiHeadingId(rawText, occurrence)

            if (node.id !== id) node.id = id
            node.dataset.wikiHeading = 'true'

            if (!node.querySelector(':scope > .heading-anchor-copy')) {
              const button = document.createElement('button')
              button.type = 'button'
              button.className = 'heading-anchor-copy'
              button.dataset.headingAnchor = id
              button.setAttribute('aria-label', `${rawText} 항목 링크 복사`)
              button.title = '이 항목 링크 복사'
              button.textContent = '#'
              node.append(button)
            }

            return {
              id,
              text: rawText,
              level: Number(node.tagName.slice(1))
            }
          })
          .filter((item): item is TocItem => Boolean(item))

        setToc((current) => {
          const unchanged =
            current.length === next.length &&
            current.every(
              (item, index) =>
                item.id === next[index]?.id &&
                item.text === next[index]?.text &&
                item.level === next[index]?.level
            )
          return unchanged ? current : next
        })

        const hash = decodeURIComponent(window.location.hash.slice(1))
        if (hash && handledHashRef.current !== hash) {
          const target = document.getElementById(hash)
          if (target) {
            handledHashRef.current = hash
            target.scrollIntoView({ block: 'start' })
          }
        }
      })
    }

    collectHeadings()

    const observer = new MutationObserver(collectHeadings)
    observer.observe(root, {
      childList: true,
      subtree: true
    })

    const onHashChange = () => {
      handledHashRef.current = ''
      collectHeadings()
    }
    window.addEventListener('hashchange', onHashChange)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [children, home])

  useEffect(() => {
    const root = document.getElementById('main-content')
    if (!root) return

    const onHeadingLinkClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest<HTMLButtonElement>('.heading-anchor-copy')
      const id = button?.dataset.headingAnchor
      if (!button || !id) return

      event.preventDefault()
      event.stopPropagation()

      const url = new URL(window.location.href)
      url.hash = id

      try {
        await navigator.clipboard.writeText(url.toString())
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = url.toString()
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.append(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }

      button.dataset.copied = 'true'
      button.textContent = '✓'
      button.setAttribute('aria-label', '항목 링크 복사됨')
      window.setTimeout(() => {
        button.dataset.copied = 'false'
        button.textContent = '#'
      }, 1200)
    }

    root.addEventListener('click', onHeadingLinkClick)
    return () => root.removeEventListener('click', onHeadingLinkClick)
  }, [])

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
    track('wiki_search_open')
  }

  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string }
      }
    ).connection

    if (
      connection?.saveData ||
      connection?.effectiveType === 'slow-2g' ||
      connection?.effectiveType === '2g'
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      for (const page of pages) {
        if (
          page.status !== 'draft' &&
          CORE_PREFETCH_TITLES.has(page.title) &&
          page.pageId.replaceAll('-', '') !== currentPageId?.replaceAll('-', '')
        ) {
          router.prefetch(withBasePath(`/page/${page.pageId}/`))
        }
      }
    }, 500)

    return () => window.clearTimeout(timer)
  }, [currentPageId, pages, router])

  useEffect(() => {
    if (!searchOpen) return

    let cancelled = false

    const withPageMeta = (data: SearchIndexPayload) => {
      const pageMeta = new Map(
        pages.map((page) => [page.pageId.replaceAll('-', ''), page])
      )

      return Array.isArray(data.pages)
        ? data.pages.map((page) => {
            const meta = pageMeta.get(page.pageId.replaceAll('-', ''))
            return {
              ...page,
              status: meta?.status,
              category: meta?.category
            }
          })
        : []
    }

    const generatedTime = (data: SearchIndexPayload | null) => {
      if (!data?.generatedAt) return 0
      const value = new Date(data.generatedAt).getTime()
      return Number.isNaN(value) ? 0 : value
    }

    if (!searchPages && clientSearchIndexCache) {
      setSearchPages(withPageMeta(clientSearchIndexCache))
    }

    const now = Date.now()
    const lastRefresh = Math.max(
      searchRefreshAtRef.current,
      clientSearchIndexCachedAt
    )

    if (
      (searchPages || clientSearchIndexCache) &&
      now - lastRefresh < 45_000
    ) {
      return
    }

    const load = async () => {
      if (!searchPages && !clientSearchIndexCache) setSearchLoading(true)
      setSearchFailed(false)

      let staticData: SearchIndexPayload | null = null
      let liveData: SearchIndexPayload | null = null

      try {
        if (!searchPages && !clientSearchIndexCache) {
          try {
            const staticResponse = await fetch(SEARCH_INDEX_URLS[0], {
              cache: 'no-store'
            })
            if (staticResponse.ok) {
              staticData = (await staticResponse.json()) as SearchIndexPayload
              clientSearchIndexCache = staticData
              clientSearchIndexCachedAt = Date.now()
              if (!cancelled) setSearchPages(withPageMeta(staticData))
            }
          } catch {
            // The live search index below remains available as a fallback.
          }
        }

        try {
          const liveResponse = await fetch(SEARCH_INDEX_URLS[1], {
            cache: 'no-store'
          })
          if (liveResponse.ok) {
            liveData = (await liveResponse.json()) as SearchIndexPayload
          }
        } catch {
          // Keep the instant static result when the live refresh is unavailable.
        }

        if (!staticData && !liveData && !searchPages) {
          throw new Error('search-index-unavailable')
        }

        const shouldApplyLive =
          Boolean(liveData) &&
          (
            !staticData ||
            generatedTime(liveData) >= generatedTime(staticData)
          )

        if (!cancelled && liveData && shouldApplyLive) {
          clientSearchIndexCache = liveData
          clientSearchIndexCachedAt = Date.now()
          setSearchPages(withPageMeta(liveData))
        }

        if (!cancelled) {
          searchRefreshAtRef.current =
            clientSearchIndexCachedAt || Date.now()
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
  }, [pages, searchOpen])

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

  const fallbackPages = useMemo(() => {
    if (!query.trim() || filteredPages.length) return []
    const source: SearchPage[] =
      searchPages ?? pages.map((page) => ({ ...page, searchText: '' }))
    return suggestFallbackPages(source, SEARCH_PRIORITY, 3)
  }, [filteredPages.length, pages, query, searchPages])

  const searchDialogResults = useMemo<WikiSearchResult[]>(
    () =>
      filteredPages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        category: pageCategoryLabel(page),
        status: searchPageStatus(page),
        snippet: page.snippet
      })),
    [filteredPages]
  )

  const searchDialogFallbacks = useMemo<WikiSearchResult[]>(
    () =>
      fallbackPages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        category: pageCategoryLabel(page),
        status: searchPageStatus(page),
        snippet: ''
      })),
    [fallbackPages]
  )

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
  }

  const navigateSearchResult = (pageId: string) => {
    const page = (searchPages ?? pages).find(
      (item) =>
        item.pageId.replaceAll('-', '') === pageId.replaceAll('-', '')
    )

    track('wiki_search_navigate', {
      category: page ? pageCategoryLabel(page) : 'unknown',
      status: page ? searchPageStatus(page) || 'unknown' : 'unknown'
    })

    router.push(withBasePath(`/page/${pageId}/`))
    closeSearch()
  }

  useEffect(() => {
    const keyword = query.trim()
    if (!keyword || searchLoading || filteredPages.length) return

    const sourceReady = Boolean(searchPages) || searchFailed
    if (!sourceReady) return

    const signature = `${keyword.length}:${searchPages ? 'index' : 'fallback'}`
    if (zeroSearchTrackedRef.current === signature) return
    zeroSearchTrackedRef.current = signature

    track('wiki_search_zero_result', {
      query_length:
        keyword.length <= 2
          ? '1-2'
          : keyword.length <= 5
            ? '3-5'
            : '6+',
      source: searchPages ? 'index' : 'fallback'
    })
  }, [
    filteredPages.length,
    query,
    searchFailed,
    searchLoading,
    searchPages
  ])

  useEffect(() => {
    setSelectedResult(0)
  }, [query, filteredPages.length])

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
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.wiki-shell')
    if (!root) return

    const onTrackedClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const element = target?.closest<HTMLElement>('[data-wiki-event]')
      const eventName = element?.dataset.wikiEvent
      if (!element || !eventName) return

      track(eventName, {
        section: element.dataset.wikiSection || 'unknown',
        target: element.dataset.wikiTarget || 'unknown',
        status: element.dataset.wikiStatus || 'unknown'
      })
    }

    root.addEventListener('click', onTrackedClick)
    return () => root.removeEventListener('click', onTrackedClick)
  }, [])

  const goTo = (id: string) => {
    const target = document.getElementById(id)
    if (target) {
      const url = new URL(window.location.href)
      url.hash = id
      window.history.pushState(null, '', url)
      handledHashRef.current = id
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }
    setMenuOpen(false)
    setMobileTocOpen(false)
  }

  return (
    <div
      className={`wiki-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}
      data-content-status={contentStatus || undefined}
    >
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

      <WikiNavigation
        pages={pages}
        currentPageId={currentPageId}
        currentCategory={currentCategory}
        openMobileCategories={openMobileCategories}
        onToggleMobileCategory={toggleMobileCategory}
        menuOpen={menuOpen}
        onCloseMenu={() => setMenuOpen(false)}
        home={home}
        toc={toc}
        activeTocId={activeTocId}
        onNavigateToc={goTo}
        readingProgress={readingProgress}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        onOpenSearch={openSearch}
        categoryForPage={pageCategoryLabel}
      />

      <main
        className={`wiki-main ${home ? 'is-home-main' : ''} ${!home && toc.length ? 'has-article-toc' : ''}`}
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
              {pages.find((page) => page.title === '기초설정(뉴비필독)') ? (
                <Link
                  className="hero-badge hero-badge-link"
                  data-wiki-event="wiki_home_navigate"
                  data-wiki-section="hero"
                  data-wiki-target="newbie-guide"
                  data-wiki-status="ready"
                  href={withBasePath(
                    `/page/${pages.find((page) => page.title === '기초설정(뉴비필독)')!.pageId}/`
                  )}
                >
                  🧭 뉴비 필독
                </Link>
              ) : (
                <span className="hero-badge">🧭 뉴비 필독</span>
              )}
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

        {!home && (
          <WikiTreasureFind
            currentPageId={currentPageId}
            pages={pages}
          />
        )}

        {home && recentReady && recentPages.length > 0 && (
          <RecentViewedSection
            ready
            pages={recentPages}
            onClear={clearRecentPages}
          />
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

      <WikiAchievementNotifier pages={pages} />

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
        <MobileTocSheet
          toc={toc}
          readingProgress={readingProgress}
          activeTocId={activeTocId}
          onClose={() => setMobileTocOpen(false)}
          onNavigate={goTo}
        />
      )}

      {searchOpen && (
        <WikiSearchDialog
          query={query}
          loading={searchLoading && !searchPages && !searchFailed}
          failed={searchFailed}
          results={searchDialogResults}
          fallbackPages={searchDialogFallbacks}
          selectedIndex={selectedResult}
          onQueryChange={setQuery}
          onSelectedIndexChange={setSelectedResult}
          onNavigate={navigateSearchResult}
          onClose={closeSearch}
        />
      )}
    </div>
  )
}
