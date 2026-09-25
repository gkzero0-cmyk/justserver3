'use client'

import { useEffect, useState } from 'react'
import { NotionRenderer } from 'react-notion-x'
import type { ExtendedRecordMap } from 'notion-types'

import { withBasePath } from '@/lib/url-utils'
import { resolveCachedAsset } from '@/lib/url-utils'

type ImageManifest = Record<string, string>

function imageKey(url: string) {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url.split('?')[0].split('#')[0]
  }
}

function cachedImageForUrl(url: string, manifest: ImageManifest) {
  const direct = manifest[imageKey(url)]
  if (direct) return direct

  let decoded = url
  try {
    decoded = decodeURIComponent(url)
  } catch {}

  const attachmentId = decoded.match(/attachment:([0-9a-f-]{36}):/i)?.[1]
  if (!attachmentId) return null

  const sourceKey = Object.keys(manifest).find((key) =>
    key.includes(`/${attachmentId}/`)
  )

  return sourceKey ? manifest[sourceKey] : null
}

export function NotionDocument({
  recordMap,
  imageManifest,
  relatedPages = []
}: {
  recordMap: ExtendedRecordMap
  imageManifest: ImageManifest
  relatedPages?: Array<{ pageId: string; title: string }>
}) {
  const [darkMode, setDarkMode] = useState(true)

  useEffect(() => {
    const root = document.documentElement
    const syncTheme = () => setDarkMode(root.dataset.theme !== 'light')
    syncTheme()

    const observer = new MutationObserver(syncTheme)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    return () => observer.disconnect()
  }, [])


  useEffect(() => {
    if (!relatedPages.length) return

    const timer = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>('.notion-page-content')
      if (!root) return

      const blockedSelector =
        'a, button, code, pre, h1, h2, h3, .notion-code, .notion-bookmark'
      const linked = new Set<string>()

      const candidates = [...relatedPages]
        .filter((page) => page.title.trim().length >= 2)
        .sort((a, b) => b.title.length - a.title.length)

      for (const page of candidates) {
        if (linked.has(page.pageId)) continue

        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              const parent = node.parentElement
              const text = node.textContent || ''
              if (!parent || !text.includes(page.title)) {
                return NodeFilter.FILTER_REJECT
              }
              if (parent.closest(blockedSelector)) {
                return NodeFilter.FILTER_REJECT
              }
              return NodeFilter.FILTER_ACCEPT
            }
          }
        )

        const textNode = walker.nextNode()
        if (!textNode?.parentNode || !textNode.textContent) continue

        const index = textNode.textContent.indexOf(page.title)
        if (index < 0) continue

        const before = textNode.textContent.slice(0, index)
        const after = textNode.textContent.slice(index + page.title.length)
        const fragment = document.createDocumentFragment()

        if (before) fragment.append(document.createTextNode(before))

        const link = document.createElement('a')
        link.className = 'wiki-auto-link'
        link.href = withBasePath(`/page/${page.pageId.replaceAll('-', '')}/`)
        link.textContent = page.title
        link.dataset.wikiEvent = 'wiki_auto_related_link'
        link.dataset.wikiSection = 'document-body'
        link.dataset.wikiTarget = page.title
        link.dataset.wikiStatus = 'ready'
        fragment.append(link)

        if (after) fragment.append(document.createTextNode(after))
        textNode.parentNode.replaceChild(fragment, textNode)
        linked.add(page.pageId)
      }
    }, 120)

    return () => window.clearTimeout(timer)
  }, [darkMode, relatedPages])

  return (
    <NotionRenderer
      recordMap={recordMap}
      fullPage={false}
      darkMode={darkMode}
      disableHeader
      mapPageUrl={(pageId) =>
        withBasePath(`/page/${pageId.replaceAll('-', '')}/`)
      }
      mapImageUrl={(url) => {
        if (!url) return ''
        const cached = cachedImageForUrl(url, imageManifest)
        return cached ? resolveCachedAsset(cached) : url
      }}
    />
  )
}
