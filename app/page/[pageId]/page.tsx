import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { WikiPageNavigation } from '@/components/wiki-page-navigation'
import { getNotionPage, notionPublicUrl } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'
import { readNotionIndex } from '@/lib/notion-index'

export const dynamicParams = true

export async function generateStaticParams() {
  const notionIndex = await readNotionIndex()
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
  const imageManifest = await readNotionAssetManifest()
  const notionIndex = await readNotionIndex()
  const rootId = notionIndex.rootPageId.replaceAll('-', '')
  const navigationPages = notionIndex.pages.filter(
    (page) => page.pageId.replaceAll('-', '') !== rootId
  )
  const currentPage =
    navigationPages.find(
      (page) => page.pageId.replaceAll('-', '') === pageId.replaceAll('-', '')
    ) ?? null
  const title = getPageTitle(recordMap) || currentPage?.title || '서버 위키'

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(pageId)}
      title={title}
      assetCount={Object.keys(imageManifest).length}
      pageCount={notionIndex.pages.length || 1}
      pages={navigationPages.map(({ pageId, title, searchText }) => ({
        pageId,
        title,
        searchText
      }))}
    >
      <WikiPageNavigation current={currentPage} pages={navigationPages} />
      <section className="document-card">
        <NotionDocument
          recordMap={recordMap}
          imageManifest={imageManifest}
        />
      </section>
      <WikiPageNavigation current={currentPage} pages={navigationPages} />
    </WikiShell>
  )
}
