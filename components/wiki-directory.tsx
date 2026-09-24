import type { NotionIndexPage } from '@/lib/notion-index'
import { withBasePath } from '@/lib/base-path'
import { resolveCachedAsset } from '@/lib/asset-url'

function iconForTitle(title: string) {
  const value = title.toLowerCase()

  if (value.includes('스토리')) return '📖'
  if (value.includes('룰') || value.includes('규칙')) return '📜'
  if (value.includes('api') || value.includes('후원')) return '💝'
  if (value.includes('뉴비') || value.includes('기초')) return '🧭'
  if (value.includes('패치')) return '📝'
  if (value.includes('강화')) return '⚒️'
  if (value.includes('수리')) return '🔧'
  if (value.includes('광') || value.includes('채광')) return '⛏️'
  if (value.includes('낚시')) return '🎣'
  if (value.includes('도축')) return '🥩'
  if (value.includes('사냥')) return '⚔️'
  if (value.includes('요리')) return '🍳'
  if (value.includes('도감')) return '📚'
  if (value.includes('파쿠르')) return '🏃'
  if (value.includes('복권')) return '🎟️'
  if (value.includes('경마')) return '🏇'
  if (value.includes('카지노')) return '🎰'
  if (value.includes('땅')) return '🏠'
  if (value.includes('빚')) return '💸'
  if (value.includes('신용')) return '💳'
  if (value.includes('물어보는')) return '❓'

  return '✦'
}

function categoryForTitle(title: string) {
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

const GROUPS = [
  {
    key: 'start',
    icon: '🧭',
    title: '시작하기',
    description: '처음 접속하기 전에 확인할 필수 안내'
  },
  {
    key: 'content',
    icon: '🎮',
    title: '주요 콘텐츠',
    description: '채광부터 도감·파쿠르·미니게임까지'
  },
  {
    key: 'growth',
    icon: '📈',
    title: '성장 · 경제',
    description: '땅, 빚, 신용등급, 장비 성장과 FAQ'
  }
] as const

export function WikiDirectory({
  pages
}: {
  pages: NotionIndexPage[]
}) {
  if (!pages.length) return null

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
        </div>
        <span>{pages.length}개 세부 문서</span>
      </div>

      <div className="directory-groups">
        {grouped.map((group) => (
          <section className="directory-group" key={group.key}>
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
                const media = page.cover || page.icon
                const resolvedMedia = media ? resolveCachedAsset(media) : null

                return (
                  <a
                    key={page.pageId}
                    href={withBasePath(`/page/${page.pageId}/`)}
                    className="directory-card"
                  >
                    <span
                      className={`directory-media ${media ? 'has-image' : ''}`}
                      style={
                        resolvedMedia
                          ? { backgroundImage: `url("${resolvedMedia}")` }
                          : undefined
                      }
                    >
                      {!media && iconForTitle(page.title)}
                    </span>

                    <span className="directory-copy">
                      <strong>{page.title}</strong>
                      <small>상세 가이드 열기</small>
                    </span>

                    <span className="directory-arrow">↗</span>
                  </a>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
