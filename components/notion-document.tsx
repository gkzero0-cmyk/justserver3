'use client'

import { NotionRenderer } from 'react-notion-x'
import type { ExtendedRecordMap } from 'notion-types'

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
      mapPageUrl={(pageId) => `/page/${pageId}`}
      mapImageUrl={(url) =>
        url ? imageManifest[imageKey(url)] ?? url : ''
      }
    />
  )
}
