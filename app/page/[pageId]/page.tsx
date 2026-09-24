import type { Metadata } from 'next'
import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { WikiPageNavigation } from '@/components/wiki-page-navigation'
import { getNotionPage, notionPublicUrl } from '@/lib/notion'
import { readNotionAssetManifest } from '@/lib/notion-assets'
import { readNotionIndex } from '@/lib/notion-index'
import { resolveCachedAsset } from '@/lib/asset-url'
import { getSiteUrl } from '@/lib/site-url'

export const dynamicParams = true

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
  const navigationPages = notionIndex.pages.filter(
    (page) => page.pageId.replaceAll('-', '') !== rootId
  )
  const currentPage =
    navigationPages.find(
      (page) => page.pageId.replaceAll('-', '') === pageId.replaceAll('-', '')
    ) ?? null
  const title = (getPageTitle(recordMap) || currentPage?.title || '서버 위키').trim()

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
    >
      <WikiPageNavigation current={currentPage} pages={navigationPages} />
      <section className="document-card">
        <NotionDocument
          recordMap={recordMap}
          imageManifest={imageManifest}
        />
      </section>
      <WikiPageNavigation
        current={currentPage}
        pages={navigationPages}
        mode="siblings"
      />
    </WikiShell>
  )
}
