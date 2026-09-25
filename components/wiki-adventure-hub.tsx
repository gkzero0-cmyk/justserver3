'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useEffect, useMemo, useState } from 'react'

import {
  buildStoryChapters,
  nextAdventureAction,
  passportProgress,
  recommendedSurvivalBuild,
  storyProgress,
  weeklyWikiBoss
} from '@/lib/wiki-adventure'
import {
  EMPTY_WIKI_FUN_STATS,
  normalizeWikiFunStats,
  type WikiFunStats
} from '@/lib/wiki-fun'
import {
  EMPTY_SURVIVAL_RECORD,
  normalizeSurvivalRecord,
  seoulWeekKey,
  type SurvivalRecord
} from '@/lib/wiki-survival'
import { iconForTitle } from '@/lib/wiki-taxonomy'
import type { WikiContentStatus } from '@/lib/wiki-ux'
import { withBasePath } from '@/lib/url-utils'

type AdventurePage = {
  pageId: string
  title: string
  category?: string
  status?: WikiContentStatus
}

type AdventureTab = 'story' | 'passport' | 'build' | 'boss'

const READ_PAGES_KEY = 'justserver3-read-pages-v1'
const FUN_STATS_KEY = 'justserver3-fun-stats-v1'
const SURVIVAL_RECORD_KEY = 'justserver3-survival-record-v1'
const SEEN_STORY_KEY = 'justserver3-seen-story-chapters-v1'
const SEEN_BOSS_KEY = 'justserver3-seen-boss-weeks-v1'

const TAB_LABELS: Array<{
  id: AdventureTab
  icon: string
  label: string
  short: string
}> = [
  { id: 'story', icon: '🎬', label: '스토리 모드', short: 'STORY' },
  { id: 'passport', icon: '📘', label: '생존 패스포트', short: 'PASSPORT' },
  { id: 'build', icon: '🛤️', label: '내 생존 빌드', short: 'BUILD' },
  { id: 'boss', icon: '⚔️', label: '주간 보스', short: 'BOSS' }
]

function normalize(value: string) {
  return value.replaceAll('-', '')
}

function readStringArray(key: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

function readFunStats() {
  try {
    return normalizeWikiFunStats(
      JSON.parse(window.localStorage.getItem(FUN_STATS_KEY) || 'null')
    )
  } catch {
    return { ...EMPTY_WIKI_FUN_STATS }
  }
}

function readSurvivalRecord() {
  try {
    return normalizeSurvivalRecord(
      JSON.parse(window.localStorage.getItem(SURVIVAL_RECORD_KEY) || 'null')
    )
  } catch {
    return { ...EMPTY_SURVIVAL_RECORD, activityByDay: {} }
  }
}

export function WikiAdventureHub({
  pages
}: {
  pages: AdventurePage[]
}) {
  const readyPages = useMemo(
    () => pages.filter((page) => page.status !== 'draft'),
    [pages]
  )
  const [activeTab, setActiveTab] = useState<AdventureTab>('story')
  const [readIds, setReadIds] = useState<string[]>([])
  const [stats, setStats] = useState<WikiFunStats>({
    ...EMPTY_WIKI_FUN_STATS
  })
  const [record, setRecord] = useState<SurvivalRecord>({
    ...EMPTY_SURVIVAL_RECORD,
    activityByDay: {}
  })
  const [progressReady, setProgressReady] = useState(false)
  const [notice, setNotice] = useState<{
    icon: string
    kicker: string
    title: string
    detail: string
  } | null>(null)

  useEffect(() => {
    const refresh = () => {
      setReadIds(readStringArray(READ_PAGES_KEY))
      setStats(readFunStats())
      setRecord(readSurvivalRecord())
    }

    refresh()
    setProgressReady(true)
    const events = [
      'storage',
      'justserver3:read-pages',
      'justserver3:fun-stats',
      'justserver3:survival-record',
      'justserver3:reading-quiz',
      'justserver3:treasure'
    ]

    for (const event of events) window.addEventListener(event, refresh)
    return () => {
      for (const event of events) window.removeEventListener(event, refresh)
    }
  }, [])

  const readSet = useMemo(
    () => new Set(readIds.map(normalize)),
    [readIds]
  )
  const chapters = useMemo(
    () => buildStoryChapters(readyPages),
    [readyPages]
  )
  const story = useMemo(
    () => storyProgress(chapters, readIds),
    [chapters, readIds]
  )
  const storyCompleted = story.filter((chapter) => chapter.complete).length
  const passport = useMemo(
    () => passportProgress(readyPages, readIds),
    [readyPages, readIds]
  )
  const build = useMemo(
    () => recommendedSurvivalBuild(readyPages, stats.lastQuizResult),
    [readyPages, stats.lastQuizResult]
  )
  const buildCompleted = build.pages.filter((page) =>
    readSet.has(normalize(page.pageId))
  ).length
  const weekKey = seoulWeekKey()
  const boss = useMemo(
    () => weeklyWikiBoss(record.activityByDay, weekKey),
    [record.activityByDay, weekKey]
  )
  const passportStamped = readyPages.filter((page) =>
    readSet.has(normalize(page.pageId))
  ).length
  const storyPercent = story.length
    ? Math.round((storyCompleted / story.length) * 100)
    : 0
  const nextAction = useMemo(
    () => nextAdventureAction(story, build.pages, readIds, readyPages),
    [build.pages, readIds, readyPages, story]
  )
  const activeTabIndex = TAB_LABELS.findIndex((tab) => tab.id === activeTab)

  useEffect(() => {
    if (!progressReady) return

    const completed = story
      .filter((chapter) => chapter.complete)
      .map((chapter) => chapter.id)
    const seen = readStringArray(SEEN_STORY_KEY)

    if (!window.localStorage.getItem(SEEN_STORY_KEY)) {
      window.localStorage.setItem(SEEN_STORY_KEY, JSON.stringify(completed))
      return
    }

    const unlocked = completed.find((id) => !seen.includes(id))
    if (!unlocked) return

    const chapter = story.find((item) => item.id === unlocked)
    window.localStorage.setItem(
      SEEN_STORY_KEY,
      JSON.stringify([...new Set([...seen, unlocked])])
    )
    setNotice({
      icon: '🎬',
      kicker: 'CHAPTER CLEARED',
      title: chapter?.title || '스토리 챕터 완료',
      detail: '다음 챕터가 열렸습니다.'
    })
    const timer = window.setTimeout(() => setNotice(null), 3000)
    return () => window.clearTimeout(timer)
  }, [progressReady, story])

  useEffect(() => {
    if (!progressReady) return

    const existing = window.localStorage.getItem(SEEN_BOSS_KEY)
    if (!existing) {
      window.localStorage.setItem(
        SEEN_BOSS_KEY,
        JSON.stringify(boss.defeated ? [weekKey] : [])
      )
      return
    }

    if (!boss.defeated) return
    const seen = readStringArray(SEEN_BOSS_KEY)
    if (seen.includes(weekKey)) return

    window.localStorage.setItem(
      SEEN_BOSS_KEY,
      JSON.stringify([...new Set([...seen, weekKey])])
    )
    setNotice({
      icon: '🏆',
      kicker: 'BOSS DEFEATED',
      title: boss.name + ' 격파 완료',
      detail: '이번 주 위키 보스를 쓰러뜨렸습니다.'
    })
    const timer = window.setTimeout(() => setNotice(null), 3400)
    return () => window.clearTimeout(timer)
  }, [boss.defeated, boss.name, progressReady, weekKey])

  const changeTab = (tab: AdventureTab) => {
    setActiveTab(tab)
    track('wiki_adventure_tab', { tab })
  }

  const moveTab = (direction: -1 | 1) => {
    const nextIndex = Math.min(
      TAB_LABELS.length - 1,
      Math.max(0, activeTabIndex + direction)
    )
    changeTab(TAB_LABELS[nextIndex].id)
  }

  return (
    <section
      className="wiki-adventure-hub"
      aria-labelledby="wiki-adventure-title"
    >
      <div className="adventure-hub-head">
        <div>
          <p>SURVIVAL ADVENTURE</p>
          <h2 id="wiki-adventure-title">위키를 읽으면 생존이 진행됩니다</h2>
          <span>
            스토리·패스포트·맞춤 빌드·주간 보스가 모두 같은 완독 기록으로 연결됩니다.
          </span>
        </div>
        <strong>
          {storyCompleted >= story.length && story.length
            ? '🏆 스토리 클리어'
            : '🎬 스토리 ' + storyCompleted + '/' + story.length}
        </strong>
      </div>

      <div className="adventure-overview" aria-label="생존 어드벤처 진행 상황">
        <span>
          <small>STORY</small>
          <strong>{storyCompleted}/{story.length}</strong>
        </span>
        <span>
          <small>PASSPORT</small>
          <strong>{passportStamped}/{readyPages.length}</strong>
        </span>
        <span>
          <small>BUILD</small>
          <strong>{buildCompleted}/{build.pages.length}</strong>
        </span>
        <span className={boss.defeated ? 'is-complete' : ''}>
          <small>WEEKLY BOSS</small>
          <strong>{boss.defeated ? '격파 ✓' : boss.remaining + ' HP'}</strong>
        </span>
      </div>

      {nextAction && (
        <Link
          className="adventure-continue-card"
          href={withBasePath('/page/' + nextAction.page.pageId + '/')}
          onClick={() =>
            track('wiki_adventure_continue', {
              kind: nextAction.kind,
              target: nextAction.page.title
            })
          }
        >
          <span className="adventure-continue-icon" aria-hidden="true">
            ▶
          </span>
          <span className="adventure-continue-copy">
            <small>{nextAction.eyebrow}</small>
            <strong>{nextAction.title}</strong>
            <em>{nextAction.description}</em>
          </span>
          <b>이어서 읽기 →</b>
        </Link>
      )}

      <div className="adventure-tabs" role="tablist" aria-label="생존 어드벤처">
        {TAB_LABELS.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            id={'adventure-tab-' + tab.id}
            role="tab"
            aria-controls={'adventure-panel-' + tab.id}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => changeTab(tab.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
                return
              }
              event.preventDefault()
              const nextIndex =
                event.key === 'ArrowRight'
                  ? (index + 1) % TAB_LABELS.length
                  : (index - 1 + TAB_LABELS.length) % TAB_LABELS.length
              const next = TAB_LABELS[nextIndex]
              changeTab(next.id)
              window.requestAnimationFrame(() => {
                document.getElementById('adventure-tab-' + next.id)?.focus()
              })
            }}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <small>{tab.short}</small>
            <strong>{tab.label}</strong>
          </button>
        ))}
      </div>

      <div className="adventure-stage">
        {activeTab === 'story' && (
          <div
            className="adventure-story"
            id="adventure-panel-story"
            role="tabpanel"
            aria-labelledby="adventure-tab-story"
          >
            <div className="adventure-story-intro">
              <span aria-hidden="true">🦁</span>
              <div>
                <small>STORY MODE</small>
                <strong>사자시 생존 기록</strong>
                <p>
                  각 장에서 하나의 선택을 골라 실제 가이드를 완독하면 다음 장이 열립니다.
                  이미 읽은 문서는 자동으로 반영됩니다.
                </p>
              </div>
            </div>

            <div className="story-progress-strip" aria-label={'스토리 진행도 ' + storyPercent + '%'}>
              <span>
                <strong>{storyCompleted}/{story.length}</strong>
                <small>CHAPTER</small>
              </span>
              <i aria-hidden="true">
                <i style={{ width: storyPercent + '%' }} />
              </i>
              <b>{storyPercent}%</b>
            </div>

            <div className="story-chapter-list">
              {story.map((chapter, index) => (
                <article
                  key={chapter.id}
                  className={[
                    chapter.unlocked ? 'is-unlocked' : 'is-locked',
                    chapter.complete ? 'is-complete' : '',
                    chapter.unlocked && !chapter.complete ? 'is-current' : ''
                  ].join(' ')}
                >
                  <div className="story-chapter-marker">
                    <span>
                      {chapter.complete
                        ? '✓'
                        : chapter.unlocked
                          ? chapter.icon
                          : '🔒'}
                    </span>
                    {index < story.length - 1 && <i aria-hidden="true" />}
                  </div>
                  <div className="story-chapter-copy">
                    <small>
                      {chapter.complete
                        ? 'CHAPTER CLEARED'
                        : chapter.unlocked
                          ? 'CHOOSE YOUR ROUTE'
                          : 'LOCKED'}
                    </small>
                    <strong>{chapter.title}</strong>
                    <p>{chapter.description}</p>

                    {chapter.unlocked ? (
                      <div className="story-choice-grid">
                        {chapter.choices.map((page) => {
                          const complete = readSet.has(normalize(page.pageId))
                          return (
                            <Link
                              key={page.pageId}
                              href={withBasePath('/page/' + page.pageId + '/')}
                              className={complete ? 'is-complete' : ''}
                              onClick={() =>
                                track('wiki_story_choice', {
                                  chapter: chapter.id,
                                  target: page.title
                                })
                              }
                            >
                              <span aria-hidden="true">
                                {complete ? '✓' : iconForTitle(page.title)}
                              </span>
                              <div>
                                <small>{page.category || '가이드'}</small>
                                <strong>{page.title}</strong>
                              </div>
                              <b>{complete ? '완독' : '선택 →'}</b>
                            </Link>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="story-locked-copy">
                        이전 챕터의 가이드 하나를 완독하면 열립니다.
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'passport' && (
          <div
            className="adventure-passport"
            id="adventure-panel-passport"
            role="tabpanel"
            aria-labelledby="adventure-tab-passport"
          >
            <div className="passport-cover">
              <div className="passport-emblem" aria-hidden="true">🦁</div>
              <small>JUST SERVER · SURVIVAL PASSPORT</small>
              <strong>나의 생존 패스포트</strong>
              <span>
                {readyPages.filter((page) =>
                  readSet.has(normalize(page.pageId))
                ).length}
                /{readyPages.length} STAMPS
              </span>
            </div>

            <div className="passport-pages">
              {passport.map((group) => (
                <article
                  key={group.category}
                  className={group.complete ? 'is-complete' : ''}
                >
                  <header>
                    <div>
                      <small>AREA STAMPS</small>
                      <strong>{group.category}</strong>
                    </div>
                    <b>
                      {group.complete
                        ? 'SPECIAL SEAL ✓'
                        : group.count + '/' + group.total}
                    </b>
                  </header>
                  {group.complete && (
                    <span className="passport-special-seal" aria-hidden="true">
                      <b>SURVIVED</b>
                      <em>✓</em>
                    </span>
                  )}
                  <div className="passport-stamps">
                    {group.pages.map((page) => (
                      <Link
                        key={page.pageId}
                        href={withBasePath('/page/' + page.pageId + '/')}
                        className={page.complete ? 'is-stamped' : ''}
                        title={
                          page.title +
                          ' · ' +
                          (page.complete ? '도장 획득' : '미완독')
                        }
                      >
                        <span aria-hidden="true">
                          {page.complete ? iconForTitle(page.title) : '○'}
                        </span>
                        <strong>{page.title}</strong>
                        <small>{page.complete ? 'STAMPED' : 'EMPTY'}</small>
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'build' && (
          <div
            className="adventure-build"
            id="adventure-panel-build"
            role="tabpanel"
            aria-labelledby="adventure-tab-build"
          >
            <header className="survival-build-head">
              <span aria-hidden="true">{build.icon}</span>
              <div>
                <small>
                  {build.personalized ? 'PERSONALIZED BUILD' : 'STARTER BUILD'}
                </small>
                <strong>{build.title}</strong>
                <p>{build.description}</p>
              </div>
              <b>
                {buildCompleted}/{build.pages.length}
              </b>
            </header>

            {!build.personalized && (
              <div className="build-personalize-note">
                🧬 PLAY ZONE의 생존형 테스트를 완료하면 결과에 맞춰 이 루트가 자동으로 바뀝니다.
              </div>
            )}

            <div className="survival-build-route">
              {build.pages.map((page, index) => {
                const complete = readSet.has(normalize(page.pageId))
                return (
                  <Link
                    key={page.pageId}
                    href={withBasePath('/page/' + page.pageId + '/')}
                    className={complete ? 'is-complete' : ''}
                    onClick={() =>
                      track('wiki_survival_build_navigate', {
                        step: String(index + 1),
                        personalized: build.personalized ? 'yes' : 'no'
                      })
                    }
                  >
                    <span className="build-step-number">
                      {complete ? '✓' : index + 1}
                    </span>
                    <span className="build-step-icon" aria-hidden="true">
                      {iconForTitle(page.title)}
                    </span>
                    <div>
                      <small>STEP {index + 1}</small>
                      <strong>{page.title}</strong>
                      <em>{complete ? '완독 완료' : '가이드 완독하기 →'}</em>
                    </div>
                    {index < build.pages.length - 1 && (
                      <i className="build-route-line" aria-hidden="true" />
                    )}
                  </Link>
                )
              })}
            </div>

            {build.pages.length > 0 && buildCompleted === build.pages.length && (
              <div className="build-complete-banner">
                ✨ 추천 생존 빌드를 완성했습니다.
              </div>
            )}
          </div>
        )}

        {activeTab === 'boss' && (
          <div
            className="adventure-boss"
            id="adventure-panel-boss"
            role="tabpanel"
            aria-labelledby="adventure-tab-boss"
          >
            <div
              className={[
                'weekly-boss-card',
                boss.defeated ? 'is-defeated' : ''
              ].join(' ')}
            >
              <div className="boss-visual">
                <span className="boss-week-label">{weekKey}~</span>
                <div className="boss-icon" aria-hidden="true">
                  {boss.defeated ? '🏆' : boss.icon}
                </div>
                {boss.defeated && (
                  <div className="boss-defeat-seal" aria-hidden="true">
                    <span>DEFEATED</span>
                    <b>WEEK CLEAR</b>
                  </div>
                )}
                <small>WEEKLY WIKI BOSS</small>
                <strong>
                  {boss.defeated
                    ? boss.name + ' 격파 완료!'
                    : boss.name}
                </strong>
                <p>{boss.flavor}</p>
              </div>

              <div className="boss-battle">
                <div className="boss-hp-row">
                  <span>
                    <small>BOSS HP</small>
                    <strong>
                      {boss.remaining}/{boss.hp}
                    </strong>
                  </span>
                  <b>
                    {boss.defeated
                      ? 'DEFEATED ✓'
                      : boss.percent + '% DAMAGE'}
                  </b>
                </div>
                <div
                  className="boss-hp-track"
                  role="progressbar"
                  aria-label="주간 위키 보스 피해량"
                  aria-valuemin={0}
                  aria-valuemax={boss.hp}
                  aria-valuenow={boss.damage}
                >
                  <i style={{ width: boss.percent + '%' }} />
                </div>

                <div className="boss-damage-grid">
                  <div>
                    <span>📖</span>
                    <strong>{boss.actions.reads}</strong>
                    <small>이번 주 완독</small>
                    <em>×12</em>
                  </div>
                  <div>
                    <span>🧠</span>
                    <strong>{boss.actions.quizzes}</strong>
                    <small>완독 퀴즈</small>
                    <em>×8</em>
                  </div>
                  <div>
                    <span>💎</span>
                    <strong>{boss.actions.treasures}</strong>
                    <small>보물 발견</small>
                    <em>×12</em>
                  </div>
                  <div>
                    <span>🎮</span>
                    <strong>
                      {boss.actions.fortune +
                        boss.actions.personalityQuiz +
                        boss.actions.random}
                    </strong>
                    <small>PLAY ZONE</small>
                    <em>보너스</em>
                  </div>
                </div>

                <div className="boss-next-hit">
                  <div>
                    <small>NEXT HIT</small>
                    <strong>
                      {boss.defeated
                        ? '이번 주 전투 완료'
                        : '가이드 1개 완독 = +12 DAMAGE'}
                    </strong>
                  </div>
                  {!boss.defeated && nextAction && (
                    <Link href={withBasePath('/page/' + nextAction.page.pageId + '/')}>
                      공격하러 가기 →
                    </Link>
                  )}
                </div>

                <p className="boss-help">
                  완독한 문서를 다시 읽어도 그날의 완독 기록으로 인정됩니다.
                  월요일마다 새로운 보스와 전투 기록이 시작됩니다.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="adventure-stage-nav" aria-label="어드벤처 탭 이동">
          <button
            type="button"
            disabled={activeTabIndex <= 0}
            onClick={() => moveTab(-1)}
          >
            ← 이전
          </button>
          <span>
            {activeTabIndex + 1}/{TAB_LABELS.length}
            <small>{TAB_LABELS[activeTabIndex]?.label}</small>
          </span>
          <button
            type="button"
            disabled={activeTabIndex >= TAB_LABELS.length - 1}
            onClick={() => moveTab(1)}
          >
            다음 →
          </button>
        </div>
      </div>

      {notice && (
        <div className="adventure-unlock-toast" role="status">
          <span aria-hidden="true">{notice.icon}</span>
          <div>
            <small>{notice.kicker}</small>
            <strong>{notice.title}</strong>
            <em>{notice.detail}</em>
          </div>
          <b>✓</b>
        </div>
      )}
    </section>
  )
}
