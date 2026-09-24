import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { getNotionPage, notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'

export default async function HomePage() {
  const recordMap = await getNotionPage(ROOT_PAGE_ID)

  return (
    <WikiShell sourceUrl={notionPublicUrl(ROOT_PAGE_ID)}>
      <section className="document-card">
        <NotionDocument recordMap={recordMap} />
      </section>
    </WikiShell>
  )
}
