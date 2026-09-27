import type { Metadata } from 'next'

import '../../document.css'
import Link from 'next/link'
import { getPageTitle } from 'notion-utils'

import { NotionDocument } from '@/components/notion-document'
import { WikiShell } from '@/components/wiki-shell'
import { WikiPageNavigation } from '@/components/wiki-page-navigation'
import { WikiDocumentFeedback } from '@/components/wiki-document-feedback'
import { WikiVerifiedFaq } from '@/components/wiki-verified-faq'
import { WikiChangeHistory } from '@/components/wiki-change-history'
import {
  WikiNextExploration,
  WikiReadingQuiz
} from '@/components/wiki-reading-game'
import { getNotionPage, notionPublicUrl } from '@/lib/notion'
import { readNotionAssetManifest, readNotionIndex, type NotionIndexPage } from '@/lib/notion-index'
import {
  deriveOptimizedVariant,
  getSiteUrl,
  resolveCachedAsset,
  withBasePath
} from '@/lib/url-utils'
import {
  isDraftPage,
  wikiContentStatus
} from '@/lib/wiki-content-status'
import { categoryTitleForPage } from '@/lib/wiki-taxonomy'
import { buildReadingQuiz } from '@/lib/wiki-reading-game'
import { wikiGuidePath } from '@/lib/wiki-routes'
import { formatSeoulDateTime } from '@/lib/wiki-ux'

export const dynamicParams = true
export const revalidate = 300

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

const PRIMARY_NEXT_BY_TITLE: Record<string, string> = {
  서버규칙: '기초설정(뉴비필독)',
  '기초설정(뉴비필독)': '채광',
  채광: '장비강화'
}

function narrowImageManifest(
  recordMap: unknown,
  manifest: Record<string, string>
) {
  const serialized = JSON.stringify(recordMap).toLowerCase()
  const entries = Object.entries(manifest).filter(([source]) => {
    const normalized = source.toLowerCase()
    if (serialized.includes(normalized)) return true

    let decoded = normalized
    try {
      decoded = decodeURIComponent(normalized)
    } catch {}

    const attachmentId = decoded.match(/attachment:([0-9a-f-]{36})/i)?.[1]
    if (attachmentId) {
      return serialized.includes(attachmentId.toLowerCase())
    }

    // file.notion.com URLs contain a shared workspace UUID followed by
    // the file-specific UUID. Match the last UUID so one workspace id
    // does not accidentally keep the entire manifest on every page.
    const ids = [...decoded.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)]
      .map((match) => match[0].toLowerCase())
    const fileId = ids.at(-1)

    return Boolean(fileId && serialized.includes(fileId))
  })

  return entries.length ? Object.fromEntries(entries) : manifest
}

function buildKeySummary(page: NotionIndexPage) {
  if (page.title === '서버규칙') {
    return [
      '재입주 시에도 입장료가 필요하며, 기존 강화 장비는 재지급됩니다.',
      '강화 아이템과 출석·도감·파쿠르 보상 아이템은 거래할 수 없습니다.',
      '자동화·비인가 프로그램·일자굴파기 등 금지 행동을 먼저 확인하세요.'
    ]
  }

  const normalized = page.searchText
    .replace(page.title, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return []

  const candidates = normalized
    .split(/(?<=[.!?。])\s+|\s*[•·]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 18)
    .filter((item, index, items) => items.indexOf(item) === index)
    .slice(0, 3)

  return candidates.map((item) =>
    item.length > 150 ? item.slice(0, 147).trimEnd() + '…' : item
  )
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

export async function generateWikiPageMetadata(
  pageId: string
): Promise<Metadata> {
  const notionIndex = await readNotionIndex()
  const page =
    notionIndex.pages.find(
      (item) => item.pageId.replaceAll('-', '') === pageId.replaceAll('-', '')
    ) ?? null

  if (!page) {
    return { title: '문서를 찾을 수 없습니다' }
  }

  const description =
    page.title === '많이 물어보는 것'
      ? '그냥서버 : 적자생존 서버규칙에서 직접 확인한 자주 묻는 질문과 답변을 빠르게 확인하세요.'
      : page.title === '장비강화'
        ? '장비강화 공식 정보는 보강 중이며, 강화 체험소에서 +15강까지 성공·실패·하락·파괴 흐름을 체험할 수 있습니다.'
        : page.searchText
          .replace(page.title, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 155) || `${page.title} 가이드`
  const draft =
    page.title === '많이 물어보는 것' ? false : isDraftPage(page)
  const siteUrl = getSiteUrl()
  const canonical = `${siteUrl}${wikiGuidePath(page)}`
  const image = page.cover || page.icon
  const resolvedImage = image ? resolveCachedAsset(image) : null

  return {
    title: page.title,
    description,
    alternates: { canonical },
    robots: draft ? { index: false, follow: true } : { index: true, follow: true },
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

export async function generateMetadata({
  params
}: {
  params: Promise<{ pageId: string }>
}): Promise<Metadata> {
  const { pageId } = await params
  return generateWikiPageMetadata(pageId)
}

export async function generateStaticParams() {
  const notionIndex = await readNotionIndex()
  const rootId = notionIndex.rootPageId.replaceAll('-', '')

  return notionIndex.pages
    .filter((page) => page.pageId.replaceAll('-', '') !== rootId)
    .map((page) => ({ pageId: page.pageId }))
}

export async function renderWikiPage(pageId: string) {
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
  const readyNavigationPages = navigationPages.filter(
    (page) => !isDraftPage(page) || page.title === '많이 물어보는 것'
  )
  const related = currentPage
    ? relatedPages(currentPage, readyNavigationPages)
    : []
  const primaryNextTitle = currentPage
    ? PRIMARY_NEXT_BY_TITLE[currentPage.title]
    : null
  const primaryNextPage = primaryNextTitle
    ? readyNavigationPages.find((page) => page.title === primaryNextTitle) ?? null
    : null
  const hasVerifiedFaq = currentPage?.title === '많이 물어보는 것'
  const isEnhancementGuide = currentPage?.title === '장비강화'
  const rawContentStatus = currentPage
    ? wikiContentStatus(currentPage)
    : 'detailed'
  const contentStatus = hasVerifiedFaq
    ? 'detailed'
    : isEnhancementGuide
      ? 'brief'
      : rawContentStatus
  const draft = contentStatus === 'draft'
  const verifiedBriefSections =
    contentStatus === 'brief' && currentPage && !isEnhancementGuide
      ? (currentPage.sections ?? [])
          .filter((section) => section.heading?.trim())
          .slice(0, 8)
      : []
  const hasVerifiedBrief = verifiedBriefSections.length > 0
  const needsNotionDocument =
    !currentPage ||
    (!draft &&
      !hasVerifiedFaq &&
      !isEnhancementGuide &&
      !hasVerifiedBrief)

  const notionPayload = needsNotionDocument
    ? await Promise.all([getNotionPage(pageId), readNotionAssetManifest()])
    : null
  const recordMap = notionPayload?.[0] ?? null
  const fullImageManifest = notionPayload?.[1] ?? {}
  const imageManifest = recordMap
    ? narrowImageManifest(recordMap, fullImageManifest)
    : {}
  const title = (
    currentPage?.title ||
    (recordMap ? getPageTitle(recordMap) : '') ||
    '서버 위키'
  ).trim()

  const readingQuiz =
    currentPage && !draft && !hasVerifiedFaq && !isEnhancementGuide
      ? buildReadingQuiz(currentPage, readyNavigationPages)
      : null
  const keySummary =
    currentPage &&
    contentStatus === 'detailed' &&
    !hasVerifiedFaq &&
    !isEnhancementGuide
      ? buildKeySummary(currentPage)
      : []

  const brandLogo = rootPage?.logo128
    ? resolveCachedAsset(rootPage.logo128)
    : rootPage?.logo
      ? resolveCachedAsset(rootPage.logo)
      : rootPage?.icon
      ? resolveCachedAsset(rootPage.icon)
      : null
  const siteUrl = getSiteUrl()
  const canonical = currentPage
    ? `${siteUrl}${wikiGuidePath(currentPage)}`
    : `${siteUrl}/page/${pageId.replaceAll('-', '')}`
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
              url: `${siteUrl}${wikiGuidePath(page)}`
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
      pageCount={navigationPages.length || 1}
      pages={navigationPages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        status:
          page.title === '많이 물어보는 것'
            ? 'detailed'
            : wikiContentStatus(page),
        category: categoryTitleForPage(page.title)
      }))}
      brandLogo={brandLogo}
      currentPageId={pageId}
      contentStatus={contentStatus}
    >
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <WikiPageNavigation current={currentPage} pages={readyNavigationPages} />

      {currentPage && (
        <div className="article-status-strip" aria-label="문서 상태">
          <span>
            <b>
              {isEnhancementGuide
                ? '체험 가이드'
                : contentStatus === 'draft'
                  ? '준비 중'
                  : contentStatus === 'brief'
                    ? '간단 안내'
                    : '상세 가이드'}
            </b>
          </span>
          <span className="article-source-status">
            <em>자료</em>
            <strong>원본 문서 연동</strong>
          </span>
          <span className="article-sync-status">
            자동 확인 <strong>5분 주기</strong>
          </span>
          {notionIndex.generatedAt && (
            <span className="article-content-update">
              마지막 동기화 <strong>{formatSeoulDateTime(notionIndex.generatedAt)}</strong>
            </span>
          )}
          {currentPage?.lastEdited && (
            <span className="article-content-update">
              문서 수정 <strong>{formatSeoulDateTime(currentPage.lastEdited)}</strong>
            </span>
          )}
        </div>
      )}

      {currentPage && (
        <WikiChangeHistory entries={currentPage.history} />
      )}

      {draft ? (
        <section className="draft-state" role="status" aria-labelledby="draft-state-title">
          <div className="draft-state-icon" aria-hidden="true">🛠️</div>
          <p>PREPARING GUIDE</p>
          <h2 id="draft-state-title">{title} 가이드를 정리하고 있습니다.</h2>
          <span>
            아직 확정된 내용이 충분하지 않아 빈 문서 대신 준비 상태를 표시합니다.
            Notion 원문이 보강되면 같은 주소에 자동으로 반영됩니다.
          </span>
          <div className="state-actions">
            <Link
              href={withBasePath(`/#category-${currentPage ? categoryKey(currentPage.title) : 'start'}`)}
              data-wiki-event="wiki_draft_navigate"
              data-wiki-section="draft-state"
              data-wiki-target="directory"
              data-wiki-status="draft"
            >
              전체 가이드 보기
            </Link>
          </div>
          {related.length > 0 && (
            <div
              className="draft-related-guides"
              aria-label="지금 읽을 수 있는 관련 가이드"
            >
              <strong>지금 읽을 수 있는 관련 가이드</strong>
              <div>
                {related.slice(0, 3).map((page) => (
                  <Link
                    key={page.pageId}
                    href={withBasePath(wikiGuidePath(page))}
                    data-wiki-event="wiki_draft_navigate"
                    data-wiki-section="draft-related"
                    data-wiki-target={page.title}
                    data-wiki-status={wikiContentStatus(page)}
                  >
                    <span>{page.title}</span>
                    <b aria-hidden="true">→</b>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          {keySummary.length > 0 && (
            <section className="article-key-summary" aria-labelledby="article-key-summary-title">
              <div>
                <p>KEY POINTS</p>
                <h2 id="article-key-summary-title">이 문서 핵심</h2>
              </div>
              <ul>
                {keySummary.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {contentStatus === 'brief' && !isEnhancementGuide && (
            <aside className="brief-notice" role="status">
              <span>간단 안내</span>
              <div>
                <strong>현재는 핵심 내용만 간단히 정리된 문서입니다.</strong>
                <small>추가 정보가 정리되면 같은 주소에 자동으로 보강됩니다.</small>
              </div>
            </aside>
          )}

          {isEnhancementGuide ? (
            <section
              className="draft-state enhancement-guide-state"
              aria-labelledby="enhancement-guide-title"
            >
              <div className="draft-state-icon" aria-hidden="true">⚒️</div>
              <p>ENHANCEMENT EXPERIENCE</p>
              <h2 id="enhancement-guide-title">
                강화 체험소는 지금 이용할 수 있습니다.
              </h2>
              <span>
                실제 서버의 확정된 강화 확률·재료 정보는 원문 보강 후 반영합니다.
                지금은 체험소에서 +15강까지 성공·실패·하락·파괴 흐름을 확인할 수 있습니다.
              </span>
              <div className="enhancement-guide-preview" aria-label="강화 체험소 규칙 요약">
                <strong>강화 체험소 기준 위험 구간</strong>
                <div>
                  <span><b>+0 ~ +4</b><small>실패 시 단계 유지</small></span>
                  <span><b>+5 ~ +6</b><small>하락 가능 구간</small></span>
                  <span><b>+7 ~ +14</b><small>하락·파괴 가능 구간</small></span>
                  <span><b>+15</b><small>체험소 최대 강화</small></span>
                </div>
                <p>
                  체험용 시뮬레이션 규칙이며 실제 서버의 공식 강화 확률을 뜻하지 않습니다.
                </p>
              </div>
              <div className="state-actions">
                <Link
                  href={withBasePath('/#enhancement-lab')}
                  data-wiki-event="wiki_enhancement_navigate"
                  data-wiki-section="enhancement-guide"
                  data-wiki-target="enhancement-lab"
                  data-wiki-status="ready"
                >
                  ⚒️ 강화 체험소 열기
                </Link>
                {related[0] && (
                  <Link
                    href={withBasePath(wikiGuidePath(related[0]))}
                    data-wiki-event="wiki_enhancement_navigate"
                    data-wiki-section="enhancement-guide"
                    data-wiki-target={related[0].title}
                    data-wiki-status="ready"
                  >
                    {related[0].title} 같이 보기
                  </Link>
                )}
              </div>
            </section>
          ) : hasVerifiedFaq ? (
            <WikiVerifiedFaq />
          ) : hasVerifiedBrief ? (
            <section
              className="verified-brief-guide"
              aria-labelledby="verified-brief-flow-title"
            >
              <div className="verified-brief-guide-head">
                <p>VERIFIED SOURCE</p>
                <h2 id="verified-brief-flow-title">
                  원문에서 확인된 {currentPage?.title} 핵심
                </h2>
                <span>
                  현재 공식 원문에서 확인 가능한 내용만 보기 좋게 정리했습니다.
                  세부 정보가 추가되면 같은 문서에 자동으로 보강됩니다.
                </span>
              </div>
              <ol>
                {verifiedBriefSections.map((section, index) => (
                  <li
                    key={section.anchor || section.heading}
                    id={section.anchor || undefined}
                  >
                    <b>{String(index + 1).padStart(2, '0')}</b>
                    <strong>{section.heading}</strong>
                    {section.text?.trim() && <small>{section.text}</small>}
                  </li>
                ))}
              </ol>
            </section>
          ) : recordMap ? (
            <section className="document-card">
              <NotionDocument
                recordMap={recordMap}
                imageManifest={imageManifest}
                relatedPages={readyNavigationPages
                  .filter(
                    (page) =>
                      page.pageId.replaceAll('-', '') !==
                      currentPage?.pageId.replaceAll('-', '')
                  )
                  .map((page) => ({
                    pageId: page.pageId,
                    title: page.title
                  }))}
              />
            </section>
          ) : null}

          {currentPage && (
            <>
              <WikiReadingQuiz
                pageId={currentPage.pageId}
                title={currentPage.title}
                quiz={readingQuiz}
              />
            </>
          )}
        </>
      )}

      {currentPage && (
        <WikiDocumentFeedback
          pageId={currentPage.pageId}
          title={currentPage.title}
          canonicalUrl={canonical}
        />
      )}

      {currentPage && !draft && related.length > 0 && (
        <WikiNextExploration
          currentTitle={currentPage.title}
          primaryPageId={primaryNextPage?.pageId}
          pages={related.map((page) => {
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

            return {
              pageId: page.pageId,
              title: page.title,
              category: categoryTitleForPage(page.title),
              image: image ? resolveCachedAsset(image) : null
            }
          })}
        />
      )}

      <WikiPageNavigation
        current={currentPage}
        pages={readyNavigationPages}
        mode="siblings"
      />
    </WikiShell>
  )
}

export default async function NotionSubPage({
  params
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  return renderWikiPage(pageId)
}
