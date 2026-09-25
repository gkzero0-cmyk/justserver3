'use client'

import { track } from '@vercel/analytics'

import { buildWikiFeedbackUrl } from '@/lib/wiki-ux'

export function WikiDocumentFeedback({
  pageId,
  title
}: {
  pageId: string
  title: string
}) {
  const items = [
    {
      kind: 'incorrect' as const,
      label: '잘못된 정보 제보',
      description: '틀렸거나 오래된 내용을 알려주세요.'
    },
    {
      kind: 'improve' as const,
      label: '내용 보강 요청',
      description: '추가되면 좋은 정보를 요청할 수 있습니다.'
    }
  ]

  return (
    <aside className="document-feedback" aria-labelledby="document-feedback-title">
      <div>
        <p>HELP IMPROVE THIS WIKI</p>
        <h2 id="document-feedback-title">문서 개선 제보</h2>
        <span>
          수정이 필요한 부분을 발견했다면 문서 정보가 미리 채워진 제보 창을 열 수 있습니다.
        </span>
      </div>

      <div className="document-feedback-actions">
        {items.map((item) => (
          <a
            key={item.kind}
            href={buildWikiFeedbackUrl({
              pageId,
              title,
              kind: item.kind
            })}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() =>
              track('wiki_feedback_open', {
                kind: item.kind,
                page_id: pageId.replaceAll('-', '')
              })
            }
          >
            <strong>{item.label}</strong>
            <small>{item.description}</small>
            <b aria-hidden="true">↗</b>
          </a>
        ))}
      </div>
    </aside>
  )
}
