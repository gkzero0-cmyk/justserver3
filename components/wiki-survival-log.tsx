'use client'

import { track } from '@vercel/analytics'
import { useEffect, useMemo, useState } from 'react'

import {
  EMPTY_WIKI_FUN_STATS,
  normalizeWikiFunStats,
  seoulDateKey,
  unlockedWikiAchievementIds,
  wikiExplorationProgress,
  wikiTitleFromAchievements,
  type WikiFunStats
} from '@/lib/wiki-fun'
import {
  EMPTY_SURVIVAL_ACTIVITY,
  EMPTY_SURVIVAL_RECORD,
  collectionProgress,
  dailyMissionIds,
  dailyMissionProgress,
  dailyTipIndex,
  normalizeSurvivalRecord,
  seoulWeekKey,
  survivalVisitStreak,
  treasurePageIds,
  weeklyActivitySummary,
  weeklyChallengeIds,
  weeklyChallengeProgress,
  type DailyMissionId,
  type SurvivalRecord,
  type WeeklyChallengeId
} from '@/lib/wiki-survival'
import type { WikiContentStatus } from '@/lib/wiki-ux'

type SurvivalPage = {
  pageId: string
  title: string
  category?: string
  status?: WikiContentStatus
}

const VISITED_PAGES_KEY = 'justserver3-visited-pages-v1'
const FUN_STATS_KEY = 'justserver3-fun-stats-v1'
const SURVIVAL_RECORD_KEY = 'justserver3-survival-record-v1'
const TREASURES_KEY = 'justserver3-treasures-v1'

const DAILY_LABELS: Record<
  DailyMissionId,
  { icon: string; title: string; description: string }
> = {
  'visit-one': {
    icon: '📖',
    title: '가이드 1개 확인',
    description: '오늘 준비된 가이드 하나를 읽어보세요.'
  },
  'visit-two': {
    icon: '🧭',
    title: '가이드 2개 탐험',
    description: '서로 다른 가이드 두 개를 확인해보세요.'
  },
  fortune: {
    icon: '🔮',
    title: '오늘의 운세 확인',
    description: 'PLAY ZONE에서 오늘의 적자 운세를 열어보세요.'
  },
  quiz: {
    icon: '🧬',
    title: '생존형 테스트 완료',
    description: '6문항 테스트를 끝까지 완료해보세요.'
  },
  random: {
    icon: '🎲',
    title: '랜덤 추천 받기',
    description: '오늘 뭐 하지? 룰렛을 한 번 돌려보세요.'
  }
}

const WEEKLY_LABELS: Record<
  WeeklyChallengeId,
  { icon: string; title: string; description: string }
> = {
  'week-visit-five': {
    icon: '🗺️',
    title: '가이드 5개 탐험',
    description: '이번 주 서로 다른 가이드 5개를 확인합니다.'
  },
  'week-fortune-three': {
    icon: '🔮',
    title: '운세 3일 확인',
    description: '이번 주 오늘의 적자 운세를 3회 확인합니다.'
  },
  'week-random-three': {
    icon: '🎲',
    title: '룰렛 3회',
    description: '랜덤 콘텐츠 추천을 3회 받아봅니다.'
  },
  'week-quiz-one': {
    icon: '🧬',
    title: '성향 분석 1회',
    description: '생존형 테스트를 한 번 완료합니다.'
  },
  'week-treasure-one': {
    icon: '💎',
    title: '위키 보물 발견',
    description: '문서 어딘가에 숨은 위키 보물을 하나 찾아보세요.'
  }
}

const QUIZ_LABELS: Record<string, string> = {
  miner: '꾸준한 광부형',
  merchant: '계산 빠른 장사꾼형',
  gambler: '한방 승부형',
  explorer: '호기심 탐험가형',
  strategist: '계획형 생존가',
  collector: '도감 수집가형'
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

export function WikiSurvivalLog({
  pages
}: {
  pages: SurvivalPage[]
}) {
  const readyPages = useMemo(
    () => pages.filter((page) => page.status !== 'draft'),
    [pages]
  )
  const [visitedIds, setVisitedIds] = useState<string[]>([])
  const [treasureIds, setTreasureIds] = useState<string[]>([])
  const [stats, setStats] = useState<WikiFunStats>({
    ...EMPTY_WIKI_FUN_STATS
  })
  const [record, setRecord] = useState<SurvivalRecord>({
    ...EMPTY_SURVIVAL_RECORD,
    activityByDay: {}
  })
  const [shareState, setShareState] = useState('')

  const refresh = () => {
    setVisitedIds(readStringArray(VISITED_PAGES_KEY))
    setTreasureIds(readStringArray(TREASURES_KEY))
    setStats(readFunStats())
    setRecord(readSurvivalRecord())
  }

  useEffect(() => {
    refresh()

    const events = [
      'storage',
      'justserver3:visited-pages',
      'justserver3:fun-stats',
      'justserver3:survival-record',
      'justserver3:treasure'
    ]

    for (const event of events) window.addEventListener(event, refresh)
    return () => {
      for (const event of events) window.removeEventListener(event, refresh)
    }
  }, [])

  const today = seoulDateKey()
  const weekKey = seoulWeekKey()
  const exploration = useMemo(
    () =>
      wikiExplorationProgress(
        visitedIds,
        readyPages.map((page) => page.pageId)
      ),
    [readyPages, visitedIds]
  )
  const achievements = useMemo(
    () => unlockedWikiAchievementIds(exploration, stats),
    [exploration, stats]
  )
  const title = wikiTitleFromAchievements(achievements)
  const streak = survivalVisitStreak(record.visitDays, today)
  const todayActivity =
    record.activityByDay[today] || EMPTY_SURVIVAL_ACTIVITY
  const todayMissionIds = dailyMissionIds(today)
  const dailyResults = todayMissionIds.map((id) => ({
    id,
    ...dailyMissionProgress(id, todayActivity)
  }))
  const dailyComplete = dailyResults.every(
    (mission) => mission.current >= mission.target
  )

  const weeklySummary = weeklyActivitySummary(record, weekKey)
  const currentWeeklyIds = weeklyChallengeIds(weekKey)
  const weeklyResults = currentWeeklyIds.map((id) => ({
    id,
    ...weeklyChallengeProgress(id, weeklySummary)
  }))

  const collections = collectionProgress(readyPages, visitedIds)
  const treasureTargets = treasurePageIds(
    readyPages.map((page) => page.pageId)
  )
  const treasureTargetSet = new Set(treasureTargets)
  const treasureCount = treasureIds
    .map((id) => id.replaceAll('-', ''))
    .filter((id) => treasureTargetSet.has(id)).length

  const tipCandidates = [
    '문서 검색은 Ctrl+K 또는 / 키로 바로 열 수 있습니다.',
    '초성 검색도 지원합니다. 예: ㅈㅂㄱㅎ → 장비강화.',
    '탐험도는 작성 중 문서를 제외한 준비된 가이드만 계산합니다.',
    '랜덤 추천은 준비가 끝난 가이드만 후보로 사용합니다.',
    readyPages.length
      ? `오늘은 ‘${readyPages[dailyTipIndex(today, readyPages.length)]?.title}’ 가이드를 한번 둘러보세요.`
      : '준비된 가이드가 추가되면 오늘의 추천도 함께 열립니다.'
  ]
  const tip =
    tipCandidates[dailyTipIndex(today, tipCandidates.length)] ||
    tipCandidates[0]

  const quizLabel = stats.lastQuizResult
    ? QUIZ_LABELS[stats.lastQuizResult] || stats.lastQuizResult
    : '아직 미측정'

  const shareProfile = async () => {
    const text = [
      '그냥서버 : 적자생존 · 내 생존 기록',
      `칭호: ${title}`,
      `생존일수: ${streak}일 연속`,
      `생존형: ${quizLabel}`,
      `위키 탐험도: ${exploration.percent}% (${exploration.count}/${exploration.total})`,
      `위키 보물: ${treasureCount}/${treasureTargets.length}`,
      `업적: ${achievements.length}/9`
    ].join('\n')

    try {
      if (navigator.share) {
        await navigator.share({
          title: '내 적자생존 기록',
          text,
          url: window.location.href
        })
      } else {
        await navigator.clipboard.writeText(
          `${text}\n${window.location.href}`
        )
        setShareState('기록을 복사했습니다.')
        window.setTimeout(() => setShareState(''), 1800)
      }
      track('wiki_survival_profile_share')
    } catch {
      setShareState('')
    }
  }

  return (
    <section
      className="wiki-survival-log"
      aria-labelledby="wiki-survival-log-title"
    >
      <div className="survival-log-head">
        <div>
          <p>SURVIVAL LOG</p>
          <h2 id="wiki-survival-log-title">내 적자생존 기록</h2>
          <span>
            위키를 사용할수록 생존일수·미션·컬렉션 기록이 쌓입니다.
          </span>
        </div>
        <span className="survival-streak-badge">
          🔥 {streak}일째 생존 중
        </span>
      </div>

      <div className="survival-profile-card">
        <div className="survival-profile-title">
          <span>현재 대표 칭호</span>
          <strong>{title}</strong>
          <small>{quizLabel}</small>
        </div>
        <div className="survival-profile-metrics">
          <div>
            <strong>{streak}</strong>
            <small>연속 생존일</small>
          </div>
          <div>
            <strong>{exploration.percent}%</strong>
            <small>위키 탐험도</small>
          </div>
          <div>
            <strong>{achievements.length}/9</strong>
            <small>업적</small>
          </div>
          <div>
            <strong>
              {treasureCount}/{treasureTargets.length}
            </strong>
            <small>위키 보물</small>
          </div>
        </div>
        <button type="button" onClick={() => void shareProfile()}>
          내 기록 공유
        </button>
        {shareState && <span className="survival-share-state">{shareState}</span>}
      </div>

      <div className="survival-dashboard-grid">
        <article className="survival-panel daily-missions-panel">
          <header>
            <div>
              <small>DAILY MISSION</small>
              <strong>오늘의 미션</strong>
            </div>
            <b className={dailyComplete ? 'is-complete' : ''}>
              {dailyComplete ? '오늘도 살아남음 ✓' : '3개 미션'}
            </b>
          </header>
          <div className="mission-list">
            {dailyResults.map((mission) => {
              const info = DAILY_LABELS[mission.id]
              const done = mission.current >= mission.target
              return (
                <div key={mission.id} className={done ? 'is-done' : ''}>
                  <span aria-hidden="true">{info.icon}</span>
                  <div>
                    <strong>{info.title}</strong>
                    <small>{info.description}</small>
                  </div>
                  <b>
                    {done
                      ? '완료'
                      : `${mission.current}/${mission.target}`}
                  </b>
                </div>
              )
            })}
          </div>
        </article>

        <article className="survival-panel weekly-challenge-panel">
          <header>
            <div>
              <small>WEEKLY CHALLENGE</small>
              <strong>이번 주 도전</strong>
            </div>
            <b>{weekKey}~</b>
          </header>
          <div className="mission-list">
            {weeklyResults.map((challenge) => {
              const info = WEEKLY_LABELS[challenge.id]
              const done = challenge.current >= challenge.target
              const percent = Math.min(
                100,
                Math.round(
                  (challenge.current / Math.max(challenge.target, 1)) * 100
                )
              )
              return (
                <div key={challenge.id} className={done ? 'is-done' : ''}>
                  <span aria-hidden="true">{info.icon}</span>
                  <div>
                    <strong>{info.title}</strong>
                    <small>{info.description}</small>
                    <i>
                      <i style={{ width: `${percent}%` }} />
                    </i>
                  </div>
                  <b>
                    {challenge.current}/{challenge.target}
                  </b>
                </div>
              )
            })}
          </div>
        </article>

        <article className="survival-panel collection-panel">
          <header>
            <div>
              <small>COLLECTION BOOK</small>
              <strong>문서 컬렉션 북</strong>
            </div>
            <b>
              {exploration.count}/{exploration.total}
            </b>
          </header>
          <div className="collection-list">
            {collections.map((collection) => (
              <div key={collection.category}>
                <span>
                  <strong>{collection.category}</strong>
                  <small>
                    {collection.count}/{collection.total}
                  </small>
                </span>
                <i>
                  <i style={{ width: `${collection.percent}%` }} />
                </i>
              </div>
            ))}
          </div>
        </article>

        <article className="survival-panel treasure-panel">
          <header>
            <div>
              <small>TREASURE HUNT</small>
              <strong>위키 보물찾기</strong>
            </div>
            <b>
              💎 {treasureCount}/{treasureTargets.length}
            </b>
          </header>
          <div className="treasure-slots" aria-label="위키 보물 수집 현황">
            {treasureTargets.map((pageId, index) => {
              const found = treasureIds
                .map((id) => id.replaceAll('-', ''))
                .includes(pageId)
              return (
                <span
                  key={pageId}
                  className={found ? 'is-found' : ''}
                  title={found ? `보물 ${index + 1} 발견` : '아직 발견하지 못한 보물'}
                >
                  {found ? ['💎', '🪙', '🔑', '📜'][index % 4] : '?'}
                </span>
              )
            })}
          </div>
          <p>
            준비된 문서를 둘러보다 보면 작은 보물이 숨어 있습니다.
          </p>
        </article>
      </div>

      <div className="survival-tip">
        <span aria-hidden="true">💡</span>
        <div>
          <small>TODAY&apos;S TIP</small>
          <strong>{tip}</strong>
        </div>
      </div>
    </section>
  )
}
