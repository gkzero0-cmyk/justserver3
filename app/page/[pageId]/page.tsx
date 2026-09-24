import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { getNotionPage, notionPublicUrl } from '@/lib/notion'

export default async function NotionSubPage({
  params
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  const recordMap = await getNotionPage(pageId)

  return (
    <WikiShell sourceUrl={notionPublicUrl(pageId)}>
      <section className="document-card">
        <NotionDocument recordMap={recordMap} />
      </section>
    </WikiShell>
  )
}
