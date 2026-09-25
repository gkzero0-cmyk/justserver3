import Link from 'next/link'

import faqEntries from '@/data/wiki-verified-faq.json'
import { withBasePath } from '@/lib/url-utils'

type VerifiedFaqEntry = {
  question: string
  answer: string
  sourceTitle: string
  sourceAnchor: string
  keywords: string[]
}

const entries = faqEntries as VerifiedFaqEntry[]

export function WikiVerifiedFaq() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer
      }
    }))
  }

  return (
    <section className="verified-faq" aria-labelledby="verified-faq-title">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="verified-faq-head">
        <div>
          <p>VERIFIED FAQ</p>
          <h2 id="verified-faq-title">빠르게 확인하는 서버 규칙</h2>
          <span>
            현재 서버규칙 문서에서 직접 확인되는 내용만 짧게 정리했습니다.
            규칙이 변경되면 원문을 기준으로 갱신합니다.
          </span>
        </div>
        <strong>{entries.length}개 확인됨</strong>
      </header>

      <div className="verified-faq-list">
        {entries.map((entry, index) => (
          <details
            key={entry.question}
            className="verified-faq-item"
            id={`faq-${index + 1}`}
          >
            <summary>
              <span className="verified-faq-number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <strong>{entry.question}</strong>
              <span className="verified-faq-toggle" aria-hidden="true">＋</span>
            </summary>
            <div className="verified-faq-answer">
              <p>{entry.answer}</p>
              <div>
                <span>근거 · {entry.sourceTitle}</span>
                <Link
                  href={withBasePath(
                    `/guide/rules/#${entry.sourceAnchor}`
                  )}
                  data-wiki-event="wiki_faq_source_open"
                  data-wiki-section="verified-faq"
                  data-wiki-target={entry.question}
                  data-wiki-status="verified"
                >
                  원문 규칙 확인 →
                </Link>
              </div>
            </div>
          </details>
        ))}
      </div>

      <aside className="verified-faq-note">
        <strong>찾는 답이 없나요?</strong>
        <span>
          검색에서 관련 문서를 확인하거나, 아직 작성 중인 항목은 자료 검토가
          끝난 뒤 순차적으로 추가됩니다.
        </span>
      </aside>
    </section>
  )
}
