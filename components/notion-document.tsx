'use client'

import { NotionRenderer } from 'react-notion-x'
import type { ExtendedRecordMap } from 'notion-types'

export function NotionDocument({
  recordMap
}: {
  recordMap: ExtendedRecordMap
}) {
  return (
    <NotionRenderer
      recordMap={recordMap}
      fullPage={false}
      darkMode
      disableHeader
      mapPageUrl={(pageId) => `/page/${pageId}`}
    />
  )
}
