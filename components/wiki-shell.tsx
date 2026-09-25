'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  MobileTocSheet,
  RecentViewedSection,
  type ReadingTocItem
} from '@/components/wiki-reading-widgets'
import { WikiMobileQuickView } from '@/components/wiki-mobile-quick-view'
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
  readWikiStateValue,
  readWikiStringArray,
  removeWikiStateValue,
  writeWikiStateValue
} from '@/lib/wiki-client-state'
import {
  normalizeSurvivalRecord,
  recordSurvivalActivity,
  recordSurvivalDay,
  seoulDateKey
} from '@/lib/wiki-survival'
import {
  suggestFallbackPages,
  updateRecentPageIds,
  wikiHeadingId,
  type WikiContentStatus
} from '@/lib/wiki-ux'
import {
  buildWikiSearchResults,
  WIKI_WIKI_SEARCH_PRIORITY,
  wikiSearchPageStatus,
  type WikiSearchIndexPayload as SearchIndexPayload,
  type WikiSearchPage as SearchPage
} from '@/lib/wiki-search'
import { withBasePath } from '@/lib/url-utils'

type TocItem = ReadingTocItem

type WikiPageLink = WikiNavigationPage & {
  status?: WikiContentStatus
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

function categoryLabel(title: string) {
  return categoryTitleForPage(title)
}

function pageCategoryLabel(page: WikiPageLink) {
  return page.category || categoryLabel(page.title)
}

function isDraftSearchPage(page: SearchPage) {
  return wikiSearchPageStatus(page) === 'draft'
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
  const [mobileQuickOpen, setMobileQuickOpen] = useState(false)
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
  const readingProgressRef = useRef(0)

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
    if (readWikiStateValue('readMigration', false)) return

    const legacyVisited = readWikiStringArray('visitedPages')
    const existingRead = readWikiStringArray('readPages')
    const migrated = [
      ...new Set(
        [...existingRead, ...legacyVisited]
          .map((value) => value.replaceAll('-', '').trim())
          .filter(Boolean)
      )
    ]

    writeWikiStateValue(
      'readPages',
      migrated,
      migrated.length ? 'justserver3:read-pages' : undefined
    )
    writeWikiStateValue('readMigration', true)
  }, [])

  useEffect(() => {
    const record = normalizeSurvivalRecord(
      readWikiStateValue('survivalRecord', null)
    )
    const next = recordSurvivalDay(record, seoulDateKey())
    writeWikiStateValue(
      'survivalRecord',
      next,
      'justserver3:survival-record'
    )
  }, [])

  useEffect(() => {
    const stored = readWikiStringArray('recentPages')

    const next = currentPageId
      ? updateRecentPageIds(stored, currentPageId, 5)
      : stored.slice(0, 5)

    setRecentPageIds(next)
    setRecentReady(true)

    if (currentPageId) {
      writeWikiStateValue('recentPages', next)

      const visited = readWikiStringArray('visitedPages')

      const nextVisited = updateRecentPageIds(
        visited,
        currentPageId,
        Math.max(pages.length, 1)
      )
      writeWikiStateValue(
        'visitedPages',
        nextVisited,
        'justserver3:visited-pages'
      )

      const record = normalizeSurvivalRecord(
        readWikiStateValue('survivalRecord', null)
      )

      const nextRecord = recordSurvivalActivity(
        record,
        seoulDateKey(),
        'visit',
        currentPageId
      )
      writeWikiStateValue(
        'survivalRecord',
        nextRecord,
        'justserver3:survival-record'
      )
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
    removeWikiStateValue('recentPages')
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
    if (home || !currentPageId || !toc.length) return

    const url = new URL(window.location.href)
    const findTerm = url.searchParams.get('find')?.trim()
    if (!findTerm) return

    let cancelled = false
    let timer = 0
    let attempts = 0

    const locateSearchMatch = () => {
      if (cancelled) return

      const root = document.querySelector<HTMLElement>('.notion-page-content')
      if (!root) {
        if (attempts++ < 12) {
          timer = window.setTimeout(locateSearchMatch, 100)
        }
        return
      }

      const normalizedTerm = findTerm.toLocaleLowerCase('ko-KR')
      const candidates = Array.from(
        root.querySelectorAll<HTMLElement>(
          'h1, h2, h3, p, li, .notion-text, .notion-callout, .notion-quote'
        )
      ).filter((element) => {
        if (element.closest('.heading-anchor-copy')) return false
        const text = element.textContent?.replace(/\s+/g, ' ').trim()
        return Boolean(
          text &&
          text.toLocaleLowerCase('ko-KR').includes(normalizedTerm)
        )
      })

      const target = candidates[0]
      if (!target) {
        if (attempts++ < 12) {
          timer = window.setTimeout(locateSearchMatch, 100)
        }
        return
      }

      const headings = toc
        .map((item) => document.getElementById(item.id))
        .filter((element): element is HTMLElement => Boolean(element))
      const nearestHeading = headings
        .filter(
          (heading) =>
            heading === target ||
            Boolean(
              heading.compareDocumentPosition(target) &
                Node.DOCUMENT_POSITION_FOLLOWING
            )
        )
        .at(-1)

      const scrollTarget = nearestHeading || target
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })

      target.classList.add('wiki-search-hit')
      window.setTimeout(() => target.classList.remove('wiki-search-hit'), 2600)

      if (nearestHeading?.id) {
        url.hash = nearestHeading.id
        window.history.replaceState(null, '', url)
        handledHashRef.current = nearestHeading.id
      }

      track('wiki_search_match_reveal', {
        anchored: Boolean(nearestHeading),
        status: contentStatus || 'unknown'
      })
    }

    timer = window.setTimeout(locateSearchMatch, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [contentStatus, currentPageId, home, toc])

  useEffect(() => {
    if (home) return

    readingProgressRef.current = 0
    setReadingProgress(0)
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

        const percent = Math.round(value * 100)
        readingProgressRef.current = percent
        setReadingProgress(percent)
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
  }, [currentPageId, home])

  const markCurrentPageRead = useCallback(
    (method: 'scroll' | 'active-time') => {
      if (!currentPageId || home || contentStatus === 'draft') return

      const normalizedPageId = currentPageId.replaceAll('-', '')
      const readPages = readWikiStringArray('readPages')
      const normalized = readPages.map((value) => value.replaceAll('-', ''))
      const firstCompletion = !normalized.includes(normalizedPageId)

      if (firstCompletion) {
        const nextReadPages = [...readPages, normalizedPageId]
        writeWikiStateValue(
          'readPages',
          nextReadPages,
          'justserver3:read-pages'
        )
      }

      const record = normalizeSurvivalRecord(
        readWikiStateValue('survivalRecord', null)
      )

      const nextRecord = recordSurvivalActivity(
        record,
        seoulDateKey(),
        'read',
        normalizedPageId
      )
      writeWikiStateValue(
        'survivalRecord',
        nextRecord,
        'justserver3:survival-record'
      )
      track(
        firstCompletion
          ? 'wiki_read_complete'
          : 'wiki_reread_complete',
        {
          method,
          status: contentStatus || 'unknown'
        }
      )
    },
    [contentStatus, currentPageId, home]
  )

  useEffect(() => {
    if (
      readingProgress >= 55 &&
      readingProgressRef.current >= 55
    ) {
      markCurrentPageRead('scroll')
    }
  }, [markCurrentPageRead, readingProgress])

  useEffect(() => {
    if (!currentPageId || home || contentStatus === 'draft') return

    let activeSeconds = 0
    const requiredSeconds = contentStatus === 'brief' ? 8 : 20
    const timer = window.setInterval(() => {
      if (
        document.visibilityState !== 'visible' ||
        readingProgressRef.current < 10
      ) {
        return
      }

      activeSeconds += 1
      if (activeSeconds >= requiredSeconds) {
        markCurrentPageRead('active-time')
        window.clearInterval(timer)
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [contentStatus, currentPageId, home, markCurrentPageRead])

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

    return buildWikiSearchResults(source, query)
  }, [pages, query, searchPages])

  const fallbackPages = useMemo(() => {
    if (!query.trim() || filteredPages.length) return []
    const source: SearchPage[] =
      searchPages ?? pages.map((page) => ({ ...page, searchText: '' }))
    return suggestFallbackPages(source, WIKI_SEARCH_PRIORITY, 3)
  }, [filteredPages.length, pages, query, searchPages])

  const searchDialogResults = useMemo<WikiSearchResult[]>(
    () =>
      filteredPages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        category: pageCategoryLabel(page),
        status: wikiSearchPageStatus(page),
        snippet: page.snippet,
        findTerm: page.findTerm,
        sectionTitle: page.sectionTitle,
        anchor: page.anchor,
        resultKey: page.resultKey
      })),
    [filteredPages]
  )

  const searchDialogFallbacks = useMemo<WikiSearchResult[]>(
    () =>
      fallbackPages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        category: pageCategoryLabel(page),
        status: wikiSearchPageStatus(page),
        snippet: ''
      })),
    [fallbackPages]
  )

  const closeSearch = () => {
    setSearchOpen(false)
    setQuery('')
  }

  const navigateSearchResult = (
    pageId: string,
    findTerm?: string,
    anchor?: string,
    source: 'result' | 'quick-answer' = 'result'
  ) => {
    const page = (searchPages ?? pages).find(
      (item) =>
        item.pageId.replaceAll('-', '') === pageId.replaceAll('-', '')
    )

    track(
      source === 'quick-answer'
        ? 'wiki_search_quick_answer'
        : 'wiki_search_navigate',
      {
        category: page ? pageCategoryLabel(page) : 'unknown',
        status: page ? wikiSearchPageStatus(page) || 'unknown' : 'unknown',
        target: page?.title || 'unknown',
        result_type: anchor ? 'section' : findTerm ? 'body' : 'title',
        query_length:
          query.trim().length <= 2
            ? '1-2'
            : query.trim().length <= 5
              ? '3-5'
              : '6+'
      }
    )

    const href = withBasePath(`/page/${pageId}/`)
    const search = findTerm
      ? `?find=${encodeURIComponent(findTerm)}`
      : ''
    const hash = anchor ? `#${encodeURIComponent(anchor)}` : ''
    router.push(`${href}${search}${hash}`)
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
        setMobileQuickOpen(false)
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

  const readyPageCount = pages.filter((page) => page.status !== 'draft').length
  const draftPageCount = pages.length - readyPageCount

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
              <span className="hero-badge">📚 공개 {readyPageCount}개</span>
              {draftPageCount > 0 && (
                <span className="hero-badge is-muted">🛠 준비 중 {draftPageCount}개</span>
              )}
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

      <nav className="mobile-bottom-nav" aria-label="모바일 빠른 메뉴">
        <Link href={withBasePath('/')} prefetch={false}>
          <span aria-hidden="true">⌂</span>
          <strong>홈</strong>
        </Link>
        <button type="button" onClick={openSearch}>
          <span aria-hidden="true">⌕</span>
          <strong>검색</strong>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileQuickOpen(true)
            track('wiki_mobile_quick_open')
          }}
        >
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

      {mobileQuickOpen && (
        <WikiMobileQuickView
          pages={pages}
          onClose={() => setMobileQuickOpen(false)}
          onOpenSearch={openSearch}
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
