'use client'

import { track } from '@vercel/analytics'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  WikiSearchDialog,
  type WikiSearchResult
} from '@/components/wiki-search-dialog'
import type { WikiNavigationPage } from '@/components/wiki-navigation'
import { categoryTitleForPage } from '@/lib/wiki-taxonomy'
import {
  buildWikiSearchResults,
  WIKI_SEARCH_PRIORITY,
  wikiSearchPageStatus,
  type WikiSearchIndexPayload as SearchIndexPayload,
  type WikiSearchPage as SearchPage
} from '@/lib/wiki-search'
import { classifyWikiSearchTopic } from '@/lib/wiki-search-topics'
import { suggestFallbackPages } from '@/lib/wiki-ux'
import { withBasePath } from '@/lib/url-utils'

let clientSearchIndexCache: SearchIndexPayload | null = null
let clientSearchIndexCachedAt = 0

const STATIC_SEARCH_INDEX_URL = withBasePath(
  '/notion-assets/search-index.json'
)
const LIVE_SEARCH_INDEX_URL = withBasePath(
  '/api/notion-webhook?resource=search-index'
)
const SEARCH_INDEX_META_URL = withBasePath(
  '/api/notion-webhook?resource=search-meta'
)
const SEARCH_REFRESH_INTERVAL_MS = 5 * 60_000

function pageCategoryLabel(page: SearchPage | WikiNavigationPage) {
  return page.category || categoryTitleForPage(page.title)
}

export function WikiSearchController({
  pages,
  onClose
}: {
  pages: WikiNavigationPage[]
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [searchPages, setSearchPages] = useState<SearchPage[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [selectedResult, setSelectedResult] = useState(0)
  const zeroSearchTrackedRef = useRef('')
  const topicSearchTrackedRef = useRef('')

  useEffect(() => {
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

    const generatedTime = (value?: string | null) => {
      if (!value) return 0
      const timestamp = new Date(value).getTime()
      return Number.isNaN(timestamp) ? 0 : timestamp
    }

    if (clientSearchIndexCache) {
      setSearchPages(withPageMeta(clientSearchIndexCache))
    }

    const now = Date.now()
    if (
      clientSearchIndexCache &&
      now - clientSearchIndexCachedAt < SEARCH_REFRESH_INTERVAL_MS
    ) {
      return
    }

    const load = async () => {
      if (!clientSearchIndexCache) setSearchLoading(true)
      setSearchFailed(false)

      let baselineData = clientSearchIndexCache
      let liveData: SearchIndexPayload | null = null

      try {
        if (!baselineData) {
          try {
            const staticResponse = await fetch(STATIC_SEARCH_INDEX_URL, {
              cache: 'force-cache'
            })
            if (staticResponse.ok) {
              baselineData =
                (await staticResponse.json()) as SearchIndexPayload
              clientSearchIndexCache = baselineData
              clientSearchIndexCachedAt = Date.now()
              if (!cancelled) {
                setSearchPages(withPageMeta(baselineData))
              }
            }
          } catch {
            // The live index below remains available as a fallback.
          }
        }

        if (baselineData) {
          try {
            const metaResponse = await fetch(SEARCH_INDEX_META_URL)
            if (metaResponse.ok) {
              const meta = (await metaResponse.json()) as {
                generatedAt?: string | null
              }

              if (
                generatedTime(meta.generatedAt) >
                generatedTime(baselineData.generatedAt)
              ) {
                const liveResponse = await fetch(LIVE_SEARCH_INDEX_URL, {
                  cache: 'no-store'
                })
                if (liveResponse.ok) {
                  liveData =
                    (await liveResponse.json()) as SearchIndexPayload
                }
              }
            }
          } catch {
            // Keep the cached/static result when freshness probing fails.
          }
        } else {
          try {
            const liveResponse = await fetch(LIVE_SEARCH_INDEX_URL, {
              cache: 'no-store'
            })
            if (liveResponse.ok) {
              liveData =
                (await liveResponse.json()) as SearchIndexPayload
            }
          } catch {
            // The failure state below handles a complete index outage.
          }
        }

        const resolvedData = liveData || baselineData
        if (!resolvedData) throw new Error('search-index-unavailable')

        if (liveData) {
          clientSearchIndexCache = liveData
          clientSearchIndexCachedAt = Date.now()
          if (!cancelled) {
            setSearchPages(withPageMeta(liveData))
          }
        } else if (baselineData) {
          clientSearchIndexCachedAt = Date.now()
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
  }, [pages])

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
        topic: classifyWikiSearchTopic(query),
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
    onClose()
  }

  useEffect(() => {
    const keyword = query.trim()
    if (keyword.length < 2) return

    const topic = classifyWikiSearchTopic(keyword)
    const signature =
      `${topic}:${keyword.length <= 2 ? '1-2' : keyword.length <= 5 ? '3-5' : '6+'}`

    if (topicSearchTrackedRef.current === signature) return
    topicSearchTrackedRef.current = signature

    track('wiki_search_topic', {
      topic,
      query_length:
        keyword.length <= 2
          ? '1-2'
          : keyword.length <= 5
            ? '3-5'
            : '6+'
    })
  }, [query])

  useEffect(() => {
    const keyword = query.trim()
    if (!keyword || searchLoading || filteredPages.length) return

    const sourceReady = Boolean(searchPages) || searchFailed
    if (!sourceReady) return

    const signature = `${keyword.length}:${searchPages ? 'index' : 'fallback'}`
    if (zeroSearchTrackedRef.current === signature) return
    zeroSearchTrackedRef.current = signature

    track('wiki_search_zero_result', {
      topic: classifyWikiSearchTopic(keyword),
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

  return (
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
      onClose={onClose}
    />
  )
}
