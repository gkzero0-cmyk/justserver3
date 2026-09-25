import type { NotionPageHistoryEntry } from '@/lib/notion-index'

function formatHistoryDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export function WikiChangeHistory({
  entries
}: {
  entries?: NotionPageHistoryEntry[]
}) {
  const visible = (entries || []).slice(0, 6)
  if (!visible.length) return null

  return (
    <details className="wiki-change-history">
      <summary>
        <span>
          <small>CHANGE HISTORY</small>
          <strong>문서 변경 이력</strong>
        </span>
        <b>{visible.length}</b>
      </summary>
      <div className="wiki-change-history-list">
        {visible.map((entry, index) => (
          <article key={`${entry.at}:${entry.summary || index}`}>
            <time>{formatHistoryDate(entry.at)}</time>
            <div>
              <strong>{entry.summary || '문서 업데이트'}</strong>
              {entry.added && (
                <p className="is-added">
                  <span>추가/변경</span>
                  {entry.added}
                </p>
              )}
              {entry.removed && (
                <p className="is-removed">
                  <span>이전 내용</span>
                  {entry.removed}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </details>
  )
}
