import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiDirectory } from '@/components/wiki-directory'
import { WikiShell } from '@/components/wiki-shell'
import { getNotionPage, notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'
import { readNotionIndex } from '@/lib/notion-index'

export const revalidate = 300

export default async function HomePage() {
  const recordMap = await getNotionPage(ROOT_PAGE_ID)
  const imageManifest = readNotionAssetManifest()
  const notionIndex = readNotionIndex()
  const title = getPageTitle(recordMap) || '서버 위키'

  const rootId = notionIndex.rootPageId.replaceAll('-', '')
  const topLevelPages = notionIndex.pages.filter(
    (page) =>
      page.pageId !== rootId &&
      page.parentId?.replaceAll('-', '') === rootId
  )

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(ROOT_PAGE_ID)}
      title={title}
      assetCount={Object.keys(imageManifest).length}
      pageCount={notionIndex.pages.length || 1}
    >
      <WikiDirectory pages={topLevelPages} />

      <section className="document-card">
        <NotionDocument
          recordMap={recordMap}
          imageManifest={imageManifest}
        />
      </section>
    </WikiShell>
  )
}
