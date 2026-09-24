import { getPageTitle } from 'notion-utils'

import { StarterGuide } from '@/components/starter-guide'
import { WikiDirectory } from '@/components/wiki-directory'
import { WikiShell } from '@/components/wiki-shell'
import { getNotionPage, notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'
import { readNotionIndex } from '@/lib/notion-index'

export default async function HomePage() {
  const recordMap = await getNotionPage(ROOT_PAGE_ID)
  const imageManifest = await readNotionAssetManifest()
  const notionIndex = await readNotionIndex()
  const title = (getPageTitle(recordMap) || '그냥서버 : 적자생존 공식 위키').trim()

  const rootId = notionIndex.rootPageId.replaceAll('-', '')
  const directoryPages = notionIndex.pages.filter(
    (page) => page.pageId.replaceAll('-', '') !== rootId
  )

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(ROOT_PAGE_ID)}
      title={title}
      assetCount={Object.keys(imageManifest).length}
      pageCount={notionIndex.pages.length || 1}
      pages={directoryPages.map(({ pageId, title, searchText }) => ({
        pageId,
        title,
        searchText
      }))}
    >
      <StarterGuide pages={directoryPages} />
      <WikiDirectory pages={directoryPages} />
    </WikiShell>
  )
}
