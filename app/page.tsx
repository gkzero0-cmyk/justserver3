import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { getNotionPage, notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'

export const revalidate = 300

export default async function HomePage() {
  const recordMap = await getNotionPage(ROOT_PAGE_ID)
  const imageManifest = readNotionAssetManifest()
  const title = getPageTitle(recordMap) || '서버 위키'

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(ROOT_PAGE_ID)}
      title={title}
      assetCount={Object.keys(imageManifest).length}
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
