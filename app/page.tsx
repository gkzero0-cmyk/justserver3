import { getPageTitle } from 'notion-utils'

import { StarterGuide } from '@/components/starter-guide'
import { WikiDirectory } from '@/components/wiki-directory'
import { WikiShell } from '@/components/wiki-shell'
import { getNotionPage, notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'
import { readNotionIndex } from '@/lib/notion-index'
import { resolveCachedAsset, withBasePath } from '@/lib/url-utils'

function formatDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export default async function HomePage() {
  const recordMap = await getNotionPage(ROOT_PAGE_ID)
  const imageManifest = await readNotionAssetManifest()
  const notionIndex = await readNotionIndex()
  const title = (getPageTitle(recordMap) || '그냥서버 : 적자생존 공식 위키').trim()

  const rootId = notionIndex.rootPageId.replaceAll('-', '')
  const rootPage =
    notionIndex.pages.find(
      (page) => page.pageId.replaceAll('-', '') === rootId
    ) ?? null
  const directoryPages = notionIndex.pages.filter(
    (page) => page.pageId.replaceAll('-', '') !== rootId
  )
  const recentPages = [...directoryPages]
    .filter((page) => page.lastEdited)
    .sort(
      (a, b) =>
        new Date(b.lastEdited || 0).getTime() -
        new Date(a.lastEdited || 0).getTime()
    )
    .slice(0, 5)

  const brandLogo = rootPage?.icon ? resolveCachedAsset(rootPage.icon) : null
  const heroImage = rootPage?.cover ? resolveCachedAsset(rootPage.cover) : null

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
      brandLogo={brandLogo}
      heroImage={heroImage}
      home
    >
      <StarterGuide pages={directoryPages} />
      <WikiDirectory pages={directoryPages} />

      <section className="recent-updates" aria-labelledby="recent-updates-title">
        <div className="recent-updates-head">
          <div>
            <p>RECENT UPDATES</p>
            <h2 id="recent-updates-title">최근 업데이트</h2>
            <span>최근 수정된 가이드부터 바로 확인할 수 있습니다.</span>
          </div>
          <a href={withBasePath('/status/')}>전체 상태 보기 →</a>
        </div>

        <div className="recent-update-list">
          {recentPages.map((page) => (
            <a
              key={page.pageId}
              href={withBasePath(`/page/${page.pageId}/`)}
              className="recent-update-card"
            >
              <span className="recent-update-date">
                {formatDate(page.lastEdited)}
              </span>
              <strong>{page.title}</strong>
              <span className="recent-update-arrow">→</span>
            </a>
          ))}
        </div>
      </section>
    </WikiShell>
  )
}
