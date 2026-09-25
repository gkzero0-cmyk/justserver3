'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useEffect, useMemo, useState } from 'react'

import {
  dailyExplorationQuest,
  readingCollectionSets,
  unreadRecommendations
} from '@/lib/wiki-reading-game'
import { iconForTitle } from '@/lib/wiki-taxonomy'
import type { WikiContentStatus } from '@/lib/wiki-ux'
import { withBasePath } from '@/lib/url-utils'

type ExplorerPage = {
  pageId: string
  title: string
  category?: string
  status?: WikiContentStatus
}

const READ_PAGES_KEY = 'justserver3-read-pages-v1'

function readStoredPages() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(READ_PAGES_KEY) || '[]'
    )
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

function normalize(value: string) {
  return value.replaceAll('-', '')
}

export function WikiReadingExplorer({
  pages
}: {
  pages: ExplorerPage[]
}) {
  const readyPages = useMemo(
    () => pages.filter((page) => page.status !== 'draft'),
    [pages]
  )
  const [readIds, setReadIds] = useState<string[]>([])
  const [dateKey, setDateKey] = useState('')

  useEffect(() => {
    setDateKey(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date())
    )

    const refresh = () => setReadIds(readStoredPages())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('justserver3:read-pages', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('justserver3:read-pages', refresh)
    }
  }, [])

  const readSet = useMemo(
    () => new Set(readIds.map(normalize)),
    [readIds]
  )
  const quest = dailyExplorationQuest(
    readyPages,
    dateKey || 'loading'
  )
  const questDone =
    quest.pages.length > 0 &&
    quest.pages.every((page) => readSet.has(normalize(page.pageId)))
  const recommendations = unreadRecommendations(readyPages, readIds, 3)
  const sets = readingCollectionSets(readyPages, readIds)
  const categories = ['시작하기', '주요 콘텐츠', '성장 · 경제']

  return (
    <section
      className="wiki-reading-explorer"
      aria-labelledby="reading-explorer-title"
    >
      <div className="reading-explorer-head">
        <div>
          <p>READ & EXPLORE</p>
          <h2 id="reading-explorer-title">읽을수록 열리는 위키 탐험</h2>
          <span>
            재미 기능을 실제 가이드 완독과 연결했습니다. 오늘의 의뢰부터 시작해보세요.
          </span>
        </div>
        <b>
          📚 {readyPages.filter((page) => readSet.has(normalize(page.pageId))).length}/{readyPages.length} 완독
        </b>
      </div>

      <div className="reading-explorer-top">
        <article className={`reading-daily-quest ${questDone ? 'is-complete' : ''}`}>
          <header>
            <span aria-hidden="true">{quest.icon}</span>
            <div>
              <small>DAILY EXPLORATION QUEST</small>
              <strong>{quest.title}</strong>
              <p>{quest.description}</p>
            </div>
            <b>{questDone ? '의뢰 완료 ✓' : `${quest.pages.filter((page) => readSet.has(normalize(page.pageId))).length}/${quest.pages.length}`}</b>
          </header>

          <div className="reading-quest-steps">
            {quest.pages.map((page, index) => {
              const complete = readSet.has(normalize(page.pageId))
              return (
                <Link
                  key={page.pageId}
                  href={withBasePath(`/page/${page.pageId}/`)}
                  className={complete ? 'is-complete' : ''}
                  onClick={() =>
                    track('wiki_exploration_quest_navigate', {
                      step: String(index + 1),
                      complete: complete ? 'yes' : 'no'
                    })
                  }
                >
                  <span>{complete ? '✓' : index + 1}</span>
                  <div>
                    <small>{page.category || '추천 가이드'}</small>
                    <strong>{page.title}</strong>
                  </div>
                  <b>→</b>
                </Link>
              )
            })}
          </div>
        </article>

        <article className="reading-unread-card">
          <header>
            <div>
              <small>NEXT UNREAD</small>
              <strong>아직 안 읽은 추천 가이드</strong>
            </div>
            <b>{recommendations.length ? '다음 목표' : '완독!'}</b>
          </header>

          {recommendations.length ? (
            <div className="reading-unread-list">
              {recommendations.map((page) => (
                <Link
                  key={page.pageId}
                  href={withBasePath(`/page/${page.pageId}/`)}
                  onClick={() =>
                    track('wiki_unread_recommendation_navigate', {
                      category: page.category || 'unknown'
                    })
                  }
                >
                  <span aria-hidden="true">{iconForTitle(page.title)}</span>
                  <div>
                    <small>{page.category}</small>
                    <strong>{page.title}</strong>
                  </div>
                  <b>읽기 →</b>
                </Link>
              ))}
            </div>
          ) : (
            <div className="reading-unread-complete">
              🏆 현재 준비된 가이드를 모두 완독했습니다.
            </div>
          )}
        </article>
      </div>

      <div className="reading-collection-sets">
        {sets.map((set) => (
          <article key={set.category} className={set.complete ? 'is-complete' : ''}>
            <span className="reading-set-icon" aria-hidden="true">
              {set.icon}
            </span>
            <div>
              <small>COLLECTION SET</small>
              <strong>{set.title}</strong>
              <p>{set.description}</p>
              <i aria-hidden="true">
                <i style={{ width: `${set.percent}%` }} />
              </i>
              <em>
                {set.complete
                  ? '배지 획득 ✓'
                  : `${set.count}/${set.total} 완독 · ${set.percent}%`}
              </em>
            </div>
          </article>
        ))}
      </div>

      <div className="reading-map">
        <header>
          <div>
            <small>WIKI EXPLORATION MAP</small>
            <strong>위키 탐험 지도</strong>
          </div>
          <span>밝은 노드는 완독한 문서입니다.</span>
        </header>

        <div className="reading-map-routes">
          {categories.map((category, categoryIndex) => {
            const categoryPages = readyPages.filter(
              (page) => page.category === category
            )
            if (!categoryPages.length) return null

            return (
              <div className="reading-map-route" key={category}>
                <div className="reading-map-category">
                  <span>{categoryIndex + 1}</span>
                  <strong>{category}</strong>
                </div>
                <div className="reading-map-nodes">
                  {categoryPages.map((page) => {
                    const complete = readSet.has(normalize(page.pageId))
                    return (
                      <Link
                        key={page.pageId}
                        href={withBasePath(`/page/${page.pageId}/`)}
                        className={complete ? 'is-complete' : ''}
                        title={complete ? `${page.title} · 완독` : `${page.title} · 미완독`}
                      >
                        <span aria-hidden="true">
                          {complete ? '✓' : iconForTitle(page.title)}
                        </span>
                        <strong>{page.title}</strong>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
