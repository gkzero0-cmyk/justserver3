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
      mapPageUrl={(pageId) => withBasePath(`/page/${pageId}/`)}
      mapImageUrl={(url) => {
        if (!url) return ''
        const cached = imageManifest[imageKey(url)]
        return cached ? resolveCachedAsset(cached) : url
      }}
    />
  )
}
