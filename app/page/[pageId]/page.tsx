import type { Metadata } from 'next'
import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { WikiPageNavigation } from '@/components/wiki-page-navigation'
import { getNotionPage, notionPublicUrl } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'
import { readNotionIndex, type NotionIndexPage } from '@/lib/notion-index'
import {
  getSiteUrl,
  resolveCachedAsset,
  withBasePath
} from '@/lib/url-utils'

export const dynamicParams = true

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
  const category = categoryKey(current.title)

  return pages
    .filter(
      (page) =>
        page.pageId !== current.pageId && categoryKey(page.title) === category
    )
    .slice(0, 3)
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

  const brandLogo = rootPage?.icon ? resolveCachedAsset(rootPage.icon) : null
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
                name: categoryKey(currentPage.title) === 'start'
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
      assetCount={Object.keys(imageManifest).length}
      pageCount={notionIndex.pages.length || 1}
      pages={navigationPages.map(({ pageId, title, searchText }) => ({
        pageId,
        title,
        searchText
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
              const image = page.cover || page.icon
              const resolvedImage = image ? resolveCachedAsset(image) : null

              return (
                <a
                  key={page.pageId}
                  href={withBasePath(`/page/${page.pageId}/`)}
                  className="related-doc-card"
                >
                  <span
                    className="related-doc-image"
                    style={
                      resolvedImage
                        ? { backgroundImage: `url("${resolvedImage}")` }
                        : undefined
                    }
                  />
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
