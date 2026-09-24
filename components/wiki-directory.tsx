import type { NotionIndexPage } from '@/lib/notion-index'

function iconForTitle(title: string) {
  const value = title.toLowerCase()

  if (value.includes('룰') || value.includes('규칙')) return '📜'
  if (value.includes('api') || value.includes('후원')) return '💝'
  if (value.includes('강화')) return '⚒️'
  if (value.includes('광산') || value.includes('채광')) return '⛏️'
  if (value.includes('가챠')) return '🎰'
  if (value.includes('던전')) return '⚔️'
  if (value.includes('패치') || value.includes('업데이트')) return '📝'
  if (value.includes('참여') || value.includes('접속')) return '📢'
  if (value.includes('도감')) return '📖'
  if (value.includes('아이템')) return '🎁'
  if (value.includes('상점') || value.includes('상점')) return '🛒'
  if (value.includes('맵') || value.includes('지역')) return '🗺️'

  return '✦'
}

export function WikiDirectory({
  pages
}: {
  pages: NotionIndexPage[]
}) {
  if (!pages.length) return null

  return (
    <section className="wiki-directory" aria-labelledby="wiki-directory-title">
      <div className="directory-heading">
        <div>
          <p>QUICK DIRECTORY</p>
          <h2 id="wiki-directory-title">주요 가이드 바로가기</h2>
        </div>
        <span>{pages.length}개 카테고리</span>
      </div>

      <div className="directory-grid">
        {pages.map((page) => (
          <a
            key={page.pageId}
            href={`/page/${page.pageId}`}
            className="directory-card"
          >
            <span className="directory-icon">{iconForTitle(page.title)}</span>
            <span className="directory-copy">
              <strong>{page.title}</strong>
              <small>상세 가이드 열기</small>
            </span>
            <span className="directory-arrow">↗</span>
          </a>
        ))}
      </div>
    </section>
  )
}
