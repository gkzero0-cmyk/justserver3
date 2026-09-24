import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { getNotionPage, notionPublicUrl } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'
import { readNotionIndex } from '@/lib/notion-index'

export const dynamicParams = false

export function generateStaticParams() {
  const notionIndex = readNotionIndex()
  const rootId = notionIndex.rootPageId.replaceAll('-', '')

  return notionIndex.pages
    .filter((page) => page.pageId.replaceAll('-', '') !== rootId)
    .map((page) => ({ pageId: page.pageId }))
}

export default async function NotionSubPage({
  params
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  const recordMap = await getNotionPage(pageId)
  const imageManifest = readNotionAssetManifest()
  const notionIndex = readNotionIndex()
  const title = getPageTitle(recordMap) || '서버 위키'

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(pageId)}
      title={title}
      assetCount={Object.keys(imageManifest).length}
      pageCount={notionIndex.pages.length || 1}
      pages={navigationPages.map(({ pageId, title }) => ({ pageId, title }))}
    >
      <section className="document-card">
        <NotionDocument
          recordMap={recordMap}
          imageManifest={imageManifest}
        />
      </section>
    </WikiShell>
  )
}
