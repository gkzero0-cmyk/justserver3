import Link from 'next/link'

import { StarterGuide } from '@/components/starter-guide'
import { WikiHomePlayground } from '@/components/wiki-home-playground'
import { WikiDirectory } from '@/components/wiki-directory'
import { WikiShell } from '@/components/wiki-shell'
import { WikiSinceVisit } from '@/components/wiki-since-visit'
import { notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'
import { readNotionIndex } from '@/lib/notion-index'
import { isDraftPage, wikiContentStatus } from '@/lib/wiki-content-status'
import { categoryTitleForPage } from '@/lib/wiki-taxonomy'
import { relativeUpdateLabel } from '@/lib/wiki-ux'
import {
  deriveOptimizedVariant,
  resolveCachedAsset,
  withBasePath
} from '@/lib/url-utils'

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
    .filter((page) => page.lastEdited && !isDraftPage(page))
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
  const heroBase = rootPage?.hero || rootPage?.cover || null
  const hero1600 =
    rootPage?.hero1600 || deriveOptimizedVariant(heroBase, 'hero1600')
  const hero1280 =
    rootPage?.hero1280 || deriveOptimizedVariant(heroBase, 'hero1280')
  const hero768 =
    rootPage?.hero768 || deriveOptimizedVariant(heroBase, 'hero768')
  const heroImage = hero1600
    ? resolveCachedAsset(hero1600)
    : heroBase
      ? resolveCachedAsset(heroBase)
      : null
  const heroImageMd = hero1280 ? resolveCachedAsset(hero1280) : heroImage
  const heroImageSm = hero768 ? resolveCachedAsset(hero768) : heroImage

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
      pageCount={directoryPages.length}
      pages={directoryPages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        status: wikiContentStatus(page),
        category: categoryTitleForPage(page.title)
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

      <section className="wiki-directory" aria-labelledby="quick-goals-title">
        <div className="directory-heading">
          <div>
            <p>QUICK START</p>
            <h2 id="quick-goals-title">지금 무엇을 하고 싶나요?</h2>
            <span>목적을 고르면 필요한 가이드나 체험 기능으로 바로 이동합니다.</span>
          </div>
          <span>빠른 탐색</span>
        </div>

        <div className="directory-grid">
          <Link
            href={withBasePath('/guide/newbie-guide/')}
            className="directory-card is-featured"
            data-wiki-event="wiki_home_navigate"
            data-wiki-section="quick-goals"
            data-wiki-target="newbie-guide"
            data-wiki-status="ready"
          >
            <span className="directory-media is-icon">🧭</span>
            <span className="directory-copy">
              <span className="directory-title-row"><strong>처음 왔어요</strong><em>추천</em></span>
              <small>필수 설정과 서버 적응 순서부터 확인합니다.</small>
            </span>
            <span className="directory-arrow">→</span>
          </Link>

          <Link
            href={withBasePath('/guide/mining/')}
            className="directory-card"
            data-wiki-event="wiki_home_navigate"
            data-wiki-section="quick-goals"
            data-wiki-target="mining"
            data-wiki-status="ready"
          >
            <span className="directory-media is-icon">⛏️</span>
            <span className="directory-copy">
              <span className="directory-title-row"><strong>돈을 벌고 싶어요</strong></span>
              <small>채광과 초반 수익 흐름을 빠르게 확인합니다.</small>
            </span>
            <span className="directory-arrow">→</span>
          </Link>

          <Link
            href={withBasePath('/guide/upgrade/')}
            className="directory-card"
            data-wiki-event="wiki_home_navigate"
            data-wiki-section="quick-goals"
            data-wiki-target="upgrade"
            data-wiki-status="draft"
          >
            <span className="directory-media is-icon">⚒️</span>
            <span className="directory-copy">
              <span className="directory-title-row"><strong>장비를 키우고 싶어요</strong><em>체험 가능</em></span>
              <small>장비강화 안내에서 강화 체험소까지 바로 이어집니다.</small>
            </span>
            <span className="directory-arrow">→</span>
          </Link>

          <Link
            href={withBasePath('/guide/faq/')}
            className="directory-card"
            data-wiki-event="wiki_home_navigate"
            data-wiki-section="quick-goals"
            data-wiki-target="faq"
            data-wiki-status="ready"
          >
            <span className="directory-media is-icon">❓</span>
            <span className="directory-copy">
              <span className="directory-title-row"><strong>궁금한 게 있어요</strong></span>
              <small>자주 묻는 질문과 확인된 답변부터 찾습니다.</small>
            </span>
            <span className="directory-arrow">→</span>
          </Link>
        </div>
      </section>

      <WikiSinceVisit
        pages={directoryPages.map((page) => ({
          pageId: page.pageId,
          title: page.title,
          lastEdited: page.lastEdited,
          summary: page.changeSummary
        }))}
      />
      <WikiDirectory pages={directoryPages} />

      <section className="recent-updates" aria-labelledby="recent-updates-title">
        <div className="recent-updates-head">
          <div>
            <p>RECENT UPDATES</p>
            <h2 id="recent-updates-title">최근 업데이트</h2>
            <span>최근 수정된 가이드부터 바로 확인할 수 있습니다.</span>
          </div>
        </div>

        <div className="recent-update-list">
          {recentPages.map((page) => (
            <Link
              key={page.pageId}
              href={withBasePath(`/page/${page.pageId}/`)}
              className="recent-update-card"
              data-wiki-event="wiki_home_navigate"
              data-wiki-section="recent-updates"
              data-wiki-target={page.title}
              data-wiki-status={wikiContentStatus(page)}
            >
              <span
                className="recent-update-date"
                title={formatDate(page.lastEdited)}
              >
                {relativeUpdateLabel(page.lastEdited)}
                <small>{formatDate(page.lastEdited)}</small>
              </span>
              <strong>{page.title}</strong>
              {page.changeSummary && (
                <small className="recent-update-summary">
                  {page.changeSummary}
                </small>
              )}
              <span className="recent-update-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      <WikiHomePlayground
        pages={directoryPages.map((page) => ({
          pageId: page.pageId,
          title: page.title,
          status: wikiContentStatus(page),
          category: categoryTitleForPage(page.title)
        }))}
      />
    </WikiShell>
  )
}
