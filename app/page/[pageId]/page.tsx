import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { getNotionPage, notionPublicUrl } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'

export const revalidate = 300

export default async function NotionSubPage({
  params
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  const recordMap = await getNotionPage(pageId)
  const imageManifest = readNotionAssetManifest()
  const title = getPageTitle(recordMap) || '서버 위키'

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(pageId)}
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
