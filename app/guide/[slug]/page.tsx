import { notFound } from 'next/navigation'

import {
  generateWikiPageMetadata,
  renderWikiPage
} from '@/app/page/[pageId]/page'
import {
  WIKI_GUIDE_ROUTES,
  wikiPageIdForSlug
} from '@/lib/wiki-routes'

export const dynamicParams = false
export const revalidate = 60

export function generateStaticParams() {
  return WIKI_GUIDE_ROUTES.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pageId = wikiPageIdForSlug(slug)

  if (!pageId) {
    return { title: '문서를 찾을 수 없습니다' }
  }

  return generateWikiPageMetadata(pageId)
}

export default async function WikiGuidePage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pageId = wikiPageIdForSlug(slug)

  if (!pageId) notFound()

  return renderWikiPage(pageId)
}
