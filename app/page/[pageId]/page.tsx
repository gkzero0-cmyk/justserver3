import type { Metadata } from 'next'
import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { WikiPageNavigation } from '@/components/wiki-page-navigation'
import { getNotionPage, notionPublicUrl } from '@/lib/notion'
import { readNotionAssetManifest, readNotionIndex, type NotionIndexPage } from '@/lib/notion-index'
import {
  deriveOptimizedVariant,
  getSiteUrl,
  resolveCachedAsset,
  withBasePath
} from '@/lib/url-utils'
import { isDraftPage } from '@/lib/wiki-content-status'

export const dynamicParams = true
export const revalidate = 60

const RELATED_BY_TITLE: Record<string, string[]> = {
  스토리: ['서버규칙', '기초설정(뉴비필독)', '빚 갚기'],
  서버규칙: ['기초설정(뉴비필독)', '많이 물어보는 것', '스토리'],
  패치노트: ['서버규칙', '많이 물어보는 것', '기초설정(뉴비필독)'],
  API: ['서버규칙', '많이 물어보는 것', '신용등급'],
  '기초설정(뉴비필독)': ['서버규칙', '빚 갚기', '채광'],
  채광: ['장비수리', '장비강화', '신용등급'],
  낚시: ['요리', '도감', '신용등급'],
  도축: ['요리', '도감', '신용등급'],
  사냥: ['장비강화', '장비수리', '도감'],
  요리: ['낚시', '도축', '도감'],
  도감: ['채광', '낚시', '사냥'],
  파쿠르: ['도감', '장비강화', '많이 물어보는 것'],
  즉석복권: ['경마장', '카지노', '신용등급'],
  경마장: ['카지노', '즉석복권', '신용등급'],
  카지노: ['경마장', '즉석복권', '신용등급'],
  '땅 구매': ['빚 갚기', '신용등급', '장비강화'],
  '빚 갚기': ['신용등급', '땅 구매', '채광'],
  신용등급: ['빚 갚기', '땅 구매', '장비강화'],
  장비수리: ['장비강화', '채광', '사냥'],
  장비강화: ['장비수리', '채광', '사냥'],
  '많이 물어보는 것': ['서버규칙', '기초설정(뉴비필독)', '패치노트']
}

function categoryKey(title: string) {
  const value = title.toLowerCase()

  if (
    value.includes('스토리') ||
    value.includes('규칙') ||
    value.includes('패치') ||
    value.includes('api') ||
    value.includes('뉴비') ||
    value.includes('기초')
  ) {
    return 'start'
  }

  if (
    value.includes('땅') ||
    value.includes('빚') ||
    value.includes('신용') ||
    value.includes('수리') ||
    value.includes('강화') ||
    value.includes('물어보는')
  ) {
    return 'growth'
  }

  return 'content'
}

function relatedPages(current: NotionIndexPage, pages: NotionIndexPage[]) {
  const byTitle = new Map(pages.map((page) => [page.title, page]))
  const explicit = (RELATED_BY_TITLE[current.title] || [])
    .map((title) => byTitle.get(title))
    .filter((page): page is NotionIndexPage => Boolean(page))
    .slice(0, 3)

  if (explicit.length === 3) return explicit

  const used = new Set([current.pageId, ...explicit.map((page) => page.pageId)])
  const fallback = pages
    .filter(
      (page) =>
        !used.has(page.pageId) &&
        categoryKey(page.title) === categoryKey(current.title)
    )
    .slice(0, 3 - explicit.length)

  return [...explicit, ...fallback]
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ pageId: string }>
}): Promise<Metadata> {
  const { pageId } = await params
  const notionIndex = await readNotionIndex()
  const page =
    notionIndex.pages.find(
      (item) => item.pageId.replaceAll('-', '') === pageId.replaceAll('-', '')
    ) ?? null

  if (!page) {
    return { title: '문서를 찾을 수 없습니다' }
  }

  const description =
    page.searchText
      .replace(page.title, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 155) || `${page.title} 가이드`
  const siteUrl = getSiteUrl()
  const canonical = `${siteUrl}/page/${page.pageId}`
  const image = page.cover || page.icon
  const resolvedImage = image ? resolveCachedAsset(image) : null

  return {
    title: page.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${page.title} | 그냥서버 : 적자생존 공식 위키`,
      description,
      url: canonical,
      type: 'article',
      locale: 'ko_KR',
      ...(resolvedImage ? { images: [{ url: resolvedImage }] } : {})
    },
    twitter: {
      card: resolvedImage ? 'summary_large_image' : 'summary',
      title: `${page.title} | 그냥서버 : 적자생존 공식 위키`,
      description,
      ...(resolvedImage ? { images: [resolvedImage] } : {})
    }
  }
}

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
  const rootPage =
    notionIndex.pages.find(
      (page) => page.pageId.replaceAll('-', '') === rootId
    ) ?? null
  const navigationPages = notionIndex.pages.filter(
    (page) => page.pageId.replaceAll('-', '') !== rootId
  )
  const currentPage =
    navigationPages.find(
      (page) => page.pageId.replaceAll('-', '') === pageId.replaceAll('-', '')
    ) ?? null
  const title = (
    getPageTitle(recordMap) ||
    currentPage?.title ||
    '서버 위키'
  ).trim()
  const related = currentPage
    ? relatedPages(currentPage, navigationPages)
    : []
  const draft = currentPage ? isDraftPage(currentPage) : false

  const brandLogo = rootPage?.logo128
    ? resolveCachedAsset(rootPage.logo128)
    : rootPage?.logo
      ? resolveCachedAsset(rootPage.logo)
      : rootPage?.icon
      ? resolveCachedAsset(rootPage.icon)
      : null
  const siteUrl = getSiteUrl()
  const canonical = `${siteUrl}/page/${pageId.replaceAll('-', '')}`
  const jsonLd = currentPage
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article',
            headline: currentPage.title,
            dateModified: currentPage.lastEdited ?? undefined,
            mainEntityOfPage: canonical,
            isRelatedTo: related.map((page) => ({
              '@type': 'WebPage',
              name: page.title,
              url: `${siteUrl}/page/${page.pageId}`
            })),
            isPartOf: {
              '@type': 'WebSite',
              name: '그냥서버 : 적자생존 공식 위키',
              url: siteUrl
            }
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: '위키 홈',
                item: siteUrl
              },
              {
                '@type': 'ListItem',
                position: 2,
                name:
                  categoryKey(currentPage.title) === 'start'
                    ? '시작하기'
                    : categoryKey(currentPage.title) === 'growth'
                      ? '성장 · 경제'
                      : '주요 콘텐츠'
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: currentPage.title,
                item: canonical
              }
            ]
          }
        ]
      }
    : null

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(pageId)}
      title={title}
      pageCount={notionIndex.pages.length || 1}
      pages={navigationPages.map(({ pageId, title }) => ({
        pageId,
        title
      }))}
      brandLogo={brandLogo}
      currentPageId={pageId}
    >
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <WikiPageNavigation current={currentPage} pages={navigationPages} />

      {draft && (
        <aside className="draft-notice" role="status">
          <span>작성 중</span>
          <div>
            <strong>이 문서는 아직 내용을 정리하고 있습니다.</strong>
            <small>확정된 내용만 표시하며, Notion 원문이 보강되면 자동으로 반영됩니다.</small>
          </div>
        </aside>
      )}

      <section className="document-card">
        <NotionDocument
          recordMap={recordMap}
          imageManifest={imageManifest}
        />
      </section>

      {related.length > 0 && (
        <section className="related-docs" aria-labelledby="related-docs-title">
          <div className="related-docs-head">
            <p>RELATED GUIDES</p>
            <h2 id="related-docs-title">같이 보면 좋은 가이드</h2>
          </div>
          <div className="related-docs-grid">
            {related.map((page) => {
              const image = [
                page.thumbnailSmall,
                deriveOptimizedVariant(page.thumbnail, 'thumb256'),
                page.thumbnail
              ].find(
                (value) =>
                  value &&
                  (/\/optimized\/thumb256\//.test(value) ||
                    /\/optimized\/thumb\//.test(value))
              )
              const resolvedImage = image ? resolveCachedAsset(image) : null

              return (
                <a
                  key={page.pageId}
                  href={withBasePath(`/page/${page.pageId}/`)}
                  className="related-doc-card"
                >
                  <span className="related-doc-image">
                    {resolvedImage && (
                      <img
                        src={resolvedImage}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        width="480"
                        height="270"
                      />
                    )}
                  </span>
                  <span>
                    <strong>{page.title}</strong>
                    <small>상세 가이드 보기</small>
                  </span>
                  <b>→</b>
                </a>
              )
            })}
          </div>
        </section>
      )}

      <WikiPageNavigation
        current={currentPage}
        pages={navigationPages}
        mode="siblings"
      />
    </WikiShell>
  )
}
