'use client'

import { NotionRenderer } from 'react-notion-x'
import type { ExtendedRecordMap } from 'notion-types'

import { withBasePath } from '@/lib/base-path'
import { resolveCachedAsset } from '@/lib/asset-url'

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
  return (
    <NotionRenderer
      recordMap={recordMap}
      fullPage={false}
      darkMode
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
