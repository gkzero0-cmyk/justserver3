import Link from 'next/link'

import type { NotionIndexPage } from '@/lib/notion-index'
import { categoryForTitle, iconForTitle } from '@/lib/wiki-taxonomy'
import { isDraftPage } from '@/lib/wiki-content-status'
import {
  deriveOptimizedVariant,
  resolveCachedAsset,
  withBasePath
} from '@/lib/url-utils'

function badgeForTitle(title: string) {
  if (title === '서버규칙' || title.includes('뉴비필독')) return '필수'
  if (title === '채광' || title === '빚 갚기' || title === '장비강화') return '핵심'
  if (title === '패치노트') return '업데이트'
  if (title === '많이 물어보는 것') return 'FAQ'
  if (title === 'API') return 'API'
  return null
}

const DESCRIPTION_BY_TITLE: Record<string, string> = {
  스토리: '서버 세계관과 시작 배경',
  서버규칙: '플레이 전 반드시 확인할 운영 규칙',
  패치노트: '최근 변경점과 업데이트 기록',
  API: '후원·API 연동 관련 안내',
  '기초설정(뉴비필독)': '첫 접속 전에 끝내야 할 필수 설정',
  채광: '광물 채집·판매·초반 수익 안내',
  낚시: '낚시 시스템과 보상 안내',
  도축: '도축 시스템과 재료 획득 안내',
  사냥: '전투·몬스터·사냥 보상 안내',
  요리: '재료 활용과 요리 시스템 안내',
  도감: '수집 도감과 달성 보상 안내',
  파쿠르: '파쿠르 진행과 보상 안내',
  즉석복권: '복권 이용 방법과 보상 안내',
  경마장: '경마장 이용 방법과 시스템 안내',
  카지노: '카지노 게임과 이용 방법 안내',
  '땅 구매': '토지 구매와 소유 시스템 안내',
  '빚 갚기': '부채 상환과 경제 진행 흐름',
  신용등급: '신용등급 조건과 혜택 안내',
  장비수리: '장비 내구도와 수리 방법 안내',
  장비강화: '강화 단계·재료·성장 안내',
  '많이 물어보는 것': '자주 묻는 질문을 빠르게 확인'
}

const FEATURED = new Set(['서버규칙','기초설정(뉴비필독)','채광','빚 갚기','장비강화'])

const GROUPS = [
  { key: 'start', icon: '🧭', title: '시작하기', description: '처음 접속하기 전에 확인할 필수 안내' },
  { key: 'content', icon: '🎮', title: '주요 콘텐츠', description: '채광부터 도감·파쿠르·미니게임까지' },
  { key: 'growth', icon: '📈', title: '성장 · 경제', description: '땅, 빚, 신용등급, 장비 성장과 FAQ' }
] as const

function mediaIdentity(value: string) {
  const filename = value.split('/').pop() || value
  return filename.replace(/\.[a-z0-9]+$/i, '')
}

function isCardThumbnail(value?: string | null): value is string {
  return Boolean(value && (/\/optimized\/thumb256\//.test(value) || /\/optimized\/thumb\//.test(value)))
}

function assignUniqueMedia(pages: NotionIndexPage[]) {
  const used = new Set<string>()
  const mediaById = new Map<string, string | null>()
  for (const page of pages) {
    const derivedSmall = deriveOptimizedVariant(page.thumbnail, 'thumb256')
    const candidates = [
      page.thumbnailSmall,
      derivedSmall,
      page.thumbnail
    ].filter(isCardThumbnail)
    const media = candidates.find((value) => !used.has(mediaIdentity(value))) ?? null
    if (media) used.add(mediaIdentity(media))
    mediaById.set(page.pageId, media)
  }
  return mediaById
}

export function WikiDirectory({ pages }: { pages: NotionIndexPage[] }) {
  if (!pages.length) return null
  const mediaById = assignUniqueMedia(pages)
  const grouped = GROUPS.map((group) => ({
    ...group,
    pages: pages.filter((page) => categoryForTitle(page.title) === group.key)
  })).filter((group) => group.pages.length > 0)

  return (
    <section className="wiki-directory" aria-labelledby="wiki-directory-title">
      <div className="directory-heading">
        <div>
          <p>QUICK DIRECTORY</p>
          <h2 id="wiki-directory-title">위키 가이드 바로가기</h2>
          <span>이미지와 아이콘만 봐도 문서를 빠르게 구분할 수 있게 정리했습니다.</span>
        </div>
        <span>{pages.length}개 세부 문서</span>
      </div>

      <div className="directory-groups">
        {grouped.map((group) => (
          <section className="directory-group" data-category={group.key} id={`category-${group.key}`} key={group.key}>
            <div className="directory-group-head">
              <span>{group.icon}</span>
              <div>
                <strong>{group.title}</strong>
                <small>{group.description}</small>
              </div>
              <em>{group.pages.length}</em>
            </div>

            <div className="directory-grid">
              {group.pages.map((page) => {
                const media = mediaById.get(page.pageId) ?? null
                const resolvedMedia = media ? resolveCachedAsset(media) : null
                const draft = isDraftPage(page)
                const badge = draft ? '작성 중' : badgeForTitle(page.title)
                const featured = FEATURED.has(page.title) && !draft

                return (
                  <Link
                    key={page.pageId}
                    href={withBasePath(`/page/${page.pageId}/`)}
                    prefetch={false}
                    className={`directory-card ${featured ? 'is-featured' : ''} ${draft ? 'is-draft' : ''}`}
                    data-status={draft ? 'draft' : 'ready'}
                  >
                    <span className={`directory-media ${media ? 'has-image' : 'is-icon'}`}>
                      {resolvedMedia ? (
                        <img src={resolvedMedia} alt="" aria-hidden="true" loading="lazy" decoding="async" width="256" height="256" />
                      ) : (
                        iconForTitle(page.title)
                      )}
                    </span>

                    <span className="directory-copy">
                      <span className="directory-title-row">
                        <strong>{page.title}</strong>
                        {badge && <em>{badge}</em>}
                      </span>
                      <small>
                        {draft
                          ? '내용을 정리하고 있습니다.'
                          : DESCRIPTION_BY_TITLE[page.title] ||
                            (featured
                              ? '처음이라면 꼭 확인하세요'
                              : '상세 가이드 열기')}
                      </small>
                    </span>

                    <span className="directory-arrow">↗</span>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
