import { WikiShell } from '@/components/wiki-shell'
import { readNotionAssetManifest } from '@/lib/notion-assets'
import { readNotionIndex } from '@/lib/notion-index'
import { notionPublicUrl, ROOT_PAGE_ID } from '@/lib/notion'
import { withBasePath } from '@/lib/url-utils'

export const revalidate = 300

export const metadata = {
  title: '위키 상태',
  description: '그냥서버 : 적자생존 공식 위키의 문서 및 이미지 동기화 상태입니다.'
}

function formatDate(value: string | null) {
  if (!value) return '확인되지 않음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '확인되지 않음'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul'
  }).format(date)
}

export default async function StatusPage() {
  const [index, manifest] = await Promise.all([
    readNotionIndex(),
    readNotionAssetManifest()
  ])

  const rootId = index.rootPageId.replaceAll('-', '')
  const pages = index.pages.filter(
    (page) => page.pageId.replaceAll('-', '') !== rootId
  )
  const optimizedAssets = new Set(
    Object.values(manifest).filter((value) => value.includes('/optimized/'))
  )
  const recentPages = [...pages]
    .filter((page) => page.lastEdited)
    .sort(
      (a, b) =>
        new Date(b.lastEdited || 0).getTime() -
        new Date(a.lastEdited || 0).getTime()
    )
    .slice(0, 5)

  return (
    <WikiShell
      sourceUrl={notionPublicUrl(ROOT_PAGE_ID)}
      title="위키 상태"
      assetCount={Object.keys(manifest).length}
      pageCount={index.pages.length || 1}
      pages={pages.map(({ pageId, title, searchText }) => ({
        pageId,
        title,
        searchText
      }))}
    >
      <section className="status-dashboard">
        <div className="status-summary">
          <div>
            <span className="status-dot" />
            <strong>정상 운영 중</strong>
            <small>Notion 원본과 위키 데이터가 연결되어 있습니다.</small>
          </div>
          <time>마지막 동기화 {formatDate(index.generatedAt)}</time>
        </div>

        <div className="status-grid">
          <article>
            <small>문서</small>
            <strong>{pages.length}</strong>
            <span>검색 가능한 세부 가이드</span>
          </article>
          <article>
            <small>이미지 매핑</small>
            <strong>{Object.keys(manifest).length}</strong>
            <span>Notion 이미지 연결 항목</span>
          </article>
          <article>
            <small>최적화 이미지</small>
            <strong>{optimizedAssets.size}</strong>
            <span>화면 표시용 WebP 자산</span>
          </article>
          <article>
            <small>갱신 방식</small>
            <strong>자동</strong>
            <span>문서 5분 / 자산 주기 동기화</span>
          </article>
        </div>

        <div className="status-recent">
          <div className="status-section-head">
            <div>
              <p>RECENT CHANGES</p>
              <h2>최근 수정 문서</h2>
            </div>
            <a href={withBasePath("/")}>위키 홈 →</a>
          </div>
          <div className="status-recent-list">
            {recentPages.map((page) => (
              <a key={page.pageId} href={withBasePath(`/page/${page.pageId}/`)}>
                <strong>{page.title}</strong>
                <span>{formatDate(page.lastEdited)}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </WikiShell>
  )
}
