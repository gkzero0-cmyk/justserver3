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
  imageManifest
}: {
  recordMap: ExtendedRecordMap
  imageManifest: ImageManifest
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
