import Link from 'next/link'

import type { NotionIndexPage } from '@/lib/notion-index'
import { isDraftPage } from '@/lib/wiki-content-status'
import { withBasePath } from '@/lib/url-utils'

const STEP_TITLES = ['서버규칙','기초설정(뉴비필독)','빚 갚기','채광','장비강화']

const STEP_META = [
  ['01', '📜', '규칙 확인', '먼저 서버 규칙과 주의사항을 확인합니다.'],
  ['02', '🧭', '기초 설정', '첫 접속 전에 필요한 설정을 끝냅니다.'],
  ['03', '💸', '경제 이해', '빚과 신용 구조를 먼저 이해합니다.'],
  ['04', '⛏️', '첫 수익', '채광을 기준으로 초반 수익 루트를 익힙니다.'],
  ['05', '⚒️', '장비 성장', '수익을 장비 강화와 성장으로 연결합니다.']
] as const

export function StarterGuide({ pages }: { pages: NotionIndexPage[] }) {
  const steps = STEP_TITLES.map((title, index) => {
    const page = pages.find((item) => item.title === title)
    return { page, meta: STEP_META[index] }
  }).filter((item) => item.page && !isDraftPage(item.page))

  if (!steps.length) return null

  return (
    <section className="starter-guide" aria-labelledby="starter-guide-title">
      <div className="starter-guide-head">
        <div>
          <p>FIRST START</p>
          <h2 id="starter-guide-title">처음 오셨나요?</h2>
          <span>현재 준비된 핵심 가이드를 순서대로 확인해보세요.</span>
        </div>
        <strong>{steps.length} STEP</strong>
      </div>

      <div className="starter-steps">
        {steps.map(({ page, meta }, index) => {
          return (
            <Link
              key={page!.pageId}
              href={withBasePath(`/page/${page!.pageId}/`)}
              className="starter-step"
              data-wiki-event="wiki_home_navigate"
              data-wiki-section="starter-guide"
              data-wiki-target={page!.title}
              data-wiki-status="ready"
            >
              <span className="starter-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="starter-icon" aria-hidden="true">{meta[1]}</span>
              <span className="starter-copy">
                <strong>{meta[2]}</strong>
                <small>{meta[3]}</small>
              </span>
              <span className="starter-target">
                <span>{page!.title}</span>
              </span>
              <span className="starter-arrow">→</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
