'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import type { NotionIndexPage } from '@/lib/notion-index'
import { isDraftPage } from '@/lib/wiki-content-status'
import { readWikiStringArray } from '@/lib/wiki-client-state'
import { withBasePath } from '@/lib/url-utils'

const STEP_TITLES = ['서버규칙','기초설정(뉴비필독)','빚 갚기','채광','장비강화']

const STEP_META = [
  ['01', '📜', '규칙 확인', '먼저 서버 규칙과 주의사항을 확인합니다.'],
  ['02', '🧭', '기초 설정', '첫 접속 전에 필요한 설정을 끝냅니다.'],
  ['03', '💸', '경제 이해', '빚과 신용 구조를 먼저 이해합니다.'],
  ['04', '⛏️', '첫 수익', '채광을 기준으로 초반 수익 루트를 익힙니다.'],
  ['05', '⚒️', '장비 성장', '수익을 장비 강화와 성장으로 연결합니다.']
] as const

function normalize(value: string) {
  return value.replaceAll('-', '')
}

export function StarterGuide({ pages }: { pages: NotionIndexPage[] }) {
  const [readIds, setReadIds] = useState<string[]>([])
  const [progressReady, setProgressReady] = useState(false)

  const steps = useMemo(
    () =>
      STEP_TITLES.map((title, index) => {
        const page = pages.find((item) => item.title === title)
        return { page, meta: STEP_META[index] }
      }).filter(
        (
          item
        ): item is {
          page: NotionIndexPage
          meta: (typeof STEP_META)[number]
        } => Boolean(item.page && !isDraftPage(item.page))
      ),
    [pages]
  )

  useEffect(() => {
    const refresh = () => {
      setReadIds(readWikiStringArray('readPages'))
      setProgressReady(true)
    }

    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('justserver3:read-pages', refresh)

    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('justserver3:read-pages', refresh)
    }
  }, [])

  if (!steps.length) return null

  const readSet = new Set(readIds.map(normalize))
  const completedCount = steps.filter(({ page }) =>
    readSet.has(normalize(page.pageId))
  ).length
  const returning = progressReady && readIds.length > 0
  const allComplete = returning && completedCount === steps.length
  const nextUnreadId = steps.find(
    ({ page }) => !readSet.has(normalize(page.pageId))
  )?.page.pageId

  return (
    <section
      className={`starter-guide ${returning ? 'is-returning' : ''} ${allComplete ? 'is-complete' : ''}`}
      aria-labelledby="starter-guide-title"
    >
      <div className="starter-guide-head">
        <div>
          <p>{returning ? 'NEXT STEP' : 'FIRST START'}</p>
          <h2 id="starter-guide-title">
            {allComplete
              ? '핵심 가이드 완료'
              : returning
                ? '다음 생존 준비'
                : '처음 오셨나요?'}
          </h2>
          <span>
            {allComplete
              ? '필수 흐름을 모두 확인했습니다. 이제 원하는 콘텐츠를 자유롭게 탐색해보세요.'
              : returning
                ? '아직 읽지 않은 핵심 가이드를 먼저 이어서 확인해보세요.'
                : '현재 준비된 핵심 가이드를 순서대로 확인해보세요.'}
          </span>
        </div>
        <strong>
          {returning
            ? `${completedCount}/${steps.length} 완료`
            : `${steps.length} STEP`}
        </strong>
      </div>

      {returning && (
        <div
          className="starter-progress"
          aria-label={`핵심 가이드 ${completedCount}개 완료, 전체 ${steps.length}개`}
        >
          <span>
            <i
              style={{
                width: `${Math.round((completedCount / steps.length) * 100)}%`
              }}
            />
          </span>
          <small>{Math.round((completedCount / steps.length) * 100)}%</small>
        </div>
      )}

      <div className="starter-steps">
        {steps.map(({ page, meta }, index) => {
          const completed = readSet.has(normalize(page.pageId))
          const isNext =
            returning &&
            !allComplete &&
            normalize(page.pageId) === normalize(nextUnreadId || '')

          return (
            <Link
              key={page.pageId}
              href={withBasePath(`/page/${page.pageId}/`)}
              className={`starter-step ${completed ? 'is-complete' : ''} ${isNext ? 'is-next' : ''}`}
              data-wiki-event="wiki_home_navigate"
              data-wiki-section={returning ? 'starter-returning' : 'starter-guide'}
              data-wiki-target={page.title}
              data-wiki-status="ready"
            >
              <span className="starter-number">
                {completed ? '✓' : String(index + 1).padStart(2, '0')}
              </span>
              <span className="starter-icon" aria-hidden="true">{meta[1]}</span>
              <span className="starter-copy">
                <strong>{completed ? `${meta[2]} 완료` : meta[2]}</strong>
                <small>
                  {completed ? '이미 읽은 가이드입니다. 다시 확인할 수 있어요.' : meta[3]}
                </small>
              </span>
              <span className="starter-target">
                <span>{page.title}</span>
                {isNext && <em>다음 추천</em>}
              </span>
              <span className="starter-arrow">{completed ? '↺' : '→'}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
