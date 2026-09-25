import { StarterGuide } from '@/components/starter-guide'
import { WikiDirectory } from '@/components/wiki-directory'
import { WikiShell } from '@/components/wiki-shell'
import { notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'
import { readNotionIndex } from '@/lib/notion-index'
import { resolveCachedAsset, withBasePath } from '@/lib/url-utils'

export const revalidate = 60

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
  const notionIndex = await readNotionIndex()
  const rootId = notionIndex.rootPageId.replaceAll('-', '')
  const rootPage =
    notionIndex.pages.find(
      (page) => page.pageId.replaceAll('-', '') === rootId
    ) ?? null
  const title = rootPage?.title?.trim() || '그냥서버 : 적자생존 공식 위키'
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

  const brandLogo = rootPage?.logo128
    ? resolveCachedAsset(rootPage.logo128)
    : rootPage?.logo
      ? resolveCachedAsset(rootPage.logo)
      : rootPage?.icon
        ? resolveCachedAsset(rootPage.icon)
        : null
  const heroImage = rootPage?.hero1600
    ? resolveCachedAsset(rootPage.hero1600)
    : rootPage?.hero
      ? resolveCachedAsset(rootPage.hero)
      : rootPage?.cover
        ? resolveCachedAsset(rootPage.cover)
        : null
  const heroImageMd = rootPage?.hero1280
    ? resolveCachedAsset(rootPage.hero1280)
    : heroImage
  const heroImageSm = rootPage?.hero768
    ? resolveCachedAsset(rootPage.hero768)
    : heroImage

  const siteUrl = 'https://justserver3.vercel.app'
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '그냥서버 : 적자생존 공식 위키',
    url: siteUrl,
    description:
      '그냥서버 : 적자생존의 서버 규칙, 시스템, 콘텐츠와 성장 가이드를 모아보는 공식 위키입니다.'
  }

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(ROOT_PAGE_ID)}
      title={title}
      pageCount={notionIndex.pages.length || 1}
      pages={directoryPages.map(({ pageId, title }) => ({
        pageId,
        title
      }))}
      brandLogo={brandLogo}
      heroImage={heroImage}
      heroImageMd={heroImageMd}
      heroImageSm={heroImageSm}
      home
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
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
              {page.changeSummary && (
                <small className="recent-update-summary">
                  {page.changeSummary}
                </small>
              )}
              <span className="recent-update-arrow">→</span>
            </a>
          ))}
        </div>
      </section>
    </WikiShell>
  )
}
