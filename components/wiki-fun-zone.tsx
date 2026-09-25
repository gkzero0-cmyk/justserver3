'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useEffect, useMemo, useState } from 'react'

import {
  EMPTY_WIKI_FUN_STATS,
  highestScoreKey,
  normalizeWikiFunStats,
  seoulDateKey,
  unlockedWikiAchievementIds,
  wikiExplorationProgress,
  wikiTitleFromAchievements,
  type WikiAchievementId,
  type WikiFunStats
} from '@/lib/wiki-fun'
import type { WikiContentStatus } from '@/lib/wiki-ux'
import { withBasePath } from '@/lib/url-utils'

type FunPage = {
  pageId: string
  title: string
  category?: string
  status?: WikiContentStatus
}

type Panel =
  | 'fortune'
  | 'quiz'
  | 'random'
  | 'progress'
  | 'achievements'
  | null

type Fortune = {
  icon: string
  title: string
  message: string
  tip: string
}

type ArchetypeId =
  | 'miner'
  | 'merchant'
  | 'gambler'
  | 'explorer'
  | 'strategist'
  | 'collector'

const VISITED_PAGES_KEY = 'justserver3-visited-pages-v1'
const FORTUNE_KEY = 'justserver3-daily-fortune-v1'
const FUN_STATS_KEY = 'justserver3-fun-stats-v1'

const FORTUNES: Fortune[] = [
  {
    icon: '⛏️',
    title: '광맥 발견의 날',
    message: '오늘은 한 칸만 더 파보고 싶은 기운이 강합니다.',
    tip: '한방보다 꾸준함. 채광 가이드를 한 번 훑고 출발해보세요.'
  },
  {
    icon: '💸',
    title: '빚 청산의 기운',
    message: '지출보다 정리가 잘 풀리는 날입니다.',
    tip: '새 소비 전에 지금 가진 자원과 해야 할 일을 먼저 정리해보세요.'
  },
  {
    icon: '🛡️',
    title: '안전 운 상승',
    message: '무리하지 않을수록 결과가 좋아지는 날입니다.',
    tip: '큰 도전 전에 규칙과 준비물을 다시 확인하면 좋습니다.'
  },
  {
    icon: '🎲',
    title: '한방 주의보',
    message: '평소보다 “이번엔 되겠지?”라는 생각이 강해질 수 있습니다.',
    tip: '오늘의 재미는 결과보다 과정에 두는 편이 마음이 편합니다.'
  },
  {
    icon: '🧭',
    title: '탐험 운 최고',
    message: '익숙한 루트보다 안 가본 곳이 눈에 들어오는 날입니다.',
    tip: '위키에서 아직 읽지 않은 가이드 하나를 골라보세요.'
  },
  {
    icon: '⚒️',
    title: '강화 참기 성공',
    message: '버튼을 누르기 전에 한 번 더 생각하는 힘이 생깁니다.',
    tip: '성장 계획을 먼저 세우면 자원을 덜 아깝게 쓸 수 있습니다.'
  },
  {
    icon: '📦',
    title: '수집가의 날',
    message: '작은 재료 하나도 왠지 버리기 아까운 날입니다.',
    tip: '인벤토리를 정리하면서 필요한 것과 아닌 것을 구분해보세요.'
  },
  {
    icon: '🍳',
    title: '생활 콘텐츠 길일',
    message: '전투보다 느긋하게 즐기는 플레이가 잘 맞는 날입니다.',
    tip: '요리나 생활 콘텐츠처럼 평소 덜 보던 가이드를 찾아보세요.'
  },
  {
    icon: '🏃',
    title: '행동력 충전',
    message: '생각보다 먼저 움직일 때 재미있는 일이 생길 수 있습니다.',
    tip: '오늘 할 콘텐츠를 하나 정하고 바로 시작해보세요.'
  },
  {
    icon: '📚',
    title: '정보력이 돈 되는 날',
    message: '모르고 지나치던 한 줄이 큰 차이를 만들 수 있습니다.',
    tip: '최근 업데이트와 뉴비 가이드를 빠르게 확인해보세요.'
  },
  {
    icon: '🤝',
    title: '협력 운 상승',
    message: '혼자 끙끙대는 것보다 같이할 때 일이 쉽게 풀립니다.',
    tip: '막히는 부분이 있다면 주변 사람에게 먼저 물어보는 것도 좋습니다.'
  },
  {
    icon: '🔥',
    title: '적자생존 모드 ON',
    message: '오늘은 실패해도 다시 해보고 싶은 기운이 강합니다.',
    tip: '무리한 목표 하나보다 작은 목표 여러 개를 깨보세요.'
  }
]

const ARCHETYPES: Record<
  ArchetypeId,
  {
    icon: string
    name: string
    tagline: string
    description: string
    recommendation: string
  }
> = {
  miner: {
    icon: '⛏️',
    name: '꾸준한 광부형',
    tagline: '한 칸씩 파다 보면 결국 내가 제일 많이 캔다',
    description:
      '큰 한방보다 확실한 누적을 믿는 타입입니다. 반복 플레이에서도 목표를 만들어 오래 버티는 편입니다.',
    recommendation: '채광 · 장비 성장 · 반복 수익 루트'
  },
  merchant: {
    icon: '💰',
    name: '계산 빠른 장사꾼형',
    tagline: '이거 지금 팔면 얼마지?',
    description:
      '자원 자체보다 흐름과 효율을 먼저 봅니다. 남들이 놓치는 가치를 찾아내는 데 재미를 느끼는 편입니다.',
    recommendation: '경제 · 거래 · 빚 관리 · 자원 운영'
  },
  gambler: {
    icon: '🎲',
    name: '한방 승부형',
    tagline: '확률이 0%만 아니면 가능성은 있다',
    description:
      '안전한 길보다 짜릿한 선택에 눈이 갑니다. 실패도 이야기거리로 만드는 플레이를 좋아하는 편입니다.',
    recommendation: '도전 콘텐츠 · 강화 · 랜덤 요소'
  },
  explorer: {
    icon: '🧭',
    name: '호기심 탐험가형',
    tagline: '저기는 뭐가 있지?',
    description:
      '정답 루트보다 새 장소와 새 시스템을 발견할 때 가장 신납니다. 위키도 필요한 문서보다 궁금한 문서를 먼저 여는 편입니다.',
    recommendation: '콘텐츠 탐험 · 스토리 · 숨은 시스템'
  },
  strategist: {
    icon: '🧠',
    name: '계획형 생존가',
    tagline: '일단 순서부터 정하고 시작하자',
    description:
      '자원과 시간을 낭비하지 않도록 계획을 세운 뒤 움직입니다. 어려운 상황에서도 루트를 정리하면 강해지는 타입입니다.',
    recommendation: '뉴비 가이드 · 성장 설계 · 규칙/시스템'
  },
  collector: {
    icon: '📦',
    name: '도감 수집가형',
    tagline: '빈칸을 보면 채우고 싶다',
    description:
      '완성도와 수집률에 강하게 끌립니다. 하나씩 모으고 체크하면서 100%를 만드는 과정 자체가 콘텐츠입니다.',
    recommendation: '도감 · 아이템 수집 · 위키 탐험도'
  }
}

const QUESTIONS: Array<{
  question: string
  answers: Array<{ label: string; type: ArchetypeId }>
}> = [
  {
    question: '서버에 들어오자마자 가장 먼저 하고 싶은 일은?',
    answers: [
      { label: '일단 자원부터 캔다', type: 'miner' },
      { label: '돈 되는 게 뭔지부터 본다', type: 'merchant' },
      { label: '처음 보는 곳부터 돌아다닌다', type: 'explorer' },
      { label: '뉴비 가이드부터 읽는다', type: 'strategist' }
    ]
  },
  {
    question: '성공 확률이 낮지만 보상이 큰 선택지가 있다면?',
    answers: [
      { label: '이게 콘텐츠지. 간다', type: 'gambler' },
      { label: '손익부터 계산한다', type: 'strategist' },
      { label: '확실한 루트로 자원을 더 모은다', type: 'miner' },
      { label: '일단 필요한 재료부터 모아둔다', type: 'collector' }
    ]
  },
  {
    question: '할 일이 딱히 없을 때 가장 끌리는 건?',
    answers: [
      { label: '안 가본 콘텐츠 구경', type: 'explorer' },
      { label: '도감이나 인벤 빈칸 채우기', type: 'collector' },
      { label: '시세나 거래 구조 살펴보기', type: 'merchant' },
      { label: '재미있는 도전 하나 걸기', type: 'gambler' }
    ]
  },
  {
    question: '희귀한 아이템을 하나 얻었다. 나는?',
    answers: [
      { label: '가치가 높을 때 팔 수 있는지 본다', type: 'merchant' },
      { label: '보관한다. 수집품은 못 참지', type: 'collector' },
      { label: '어디에 쓰는 게 효율적인지 조사한다', type: 'strategist' },
      { label: '이 아이템과 관련된 콘텐츠를 찾아본다', type: 'explorer' }
    ]
  },
  {
    question: '계획이 꼬였을 때 가장 가까운 반응은?',
    answers: [
      { label: '원인을 정리하고 다음 루트를 짠다', type: 'strategist' },
      { label: '다시 하면 된다. 계속 간다', type: 'miner' },
      { label: '이왕 이렇게 된 거 더 큰 승부를 본다', type: 'gambler' },
      { label: '손해를 줄일 방법부터 찾는다', type: 'merchant' }
    ]
  },
  {
    question: '내가 서버에서 가장 만족하는 순간은?',
    answers: [
      { label: '도감이나 목표가 100% 채워졌을 때', type: 'collector' },
      { label: '자산이 눈에 띄게 늘었을 때', type: 'merchant' },
      { label: '남들이 모르는 걸 발견했을 때', type: 'explorer' },
      { label: '말도 안 되는 도전에 성공했을 때', type: 'gambler' }
    ]
  }
]

const ACHIEVEMENTS: Array<{
  id: WikiAchievementId
  icon: string
  title: string
  description: string
  secret?: boolean
}> = [
  {
    id: 'first-step',
    icon: '👣',
    title: '첫 발자국',
    description: '준비된 가이드 1개를 확인했습니다.'
  },
  {
    id: 'guide',
    icon: '🗺️',
    title: '위키 길잡이',
    description: '준비된 가이드 3개를 확인했습니다.'
  },
  {
    id: 'explorer',
    icon: '🧭',
    title: '적자생존 탐험가',
    description: '위키 탐험도 50%를 달성했습니다.'
  },
  {
    id: 'conqueror',
    icon: '👑',
    title: '위키 정복자',
    description: '현재 준비된 모든 가이드를 발견했습니다.'
  },
  {
    id: 'fortune',
    icon: '🔮',
    title: '운세 입문자',
    description: '오늘의 적자 운세를 한 번 확인했습니다.'
  },
  {
    id: 'analyst',
    icon: '🧬',
    title: '성향 분석가',
    description: '생존형 테스트를 끝까지 완료했습니다.'
  },
  {
    id: 'randomizer',
    icon: '🎲',
    title: '운명 결정사',
    description: '랜덤 추천을 3번 받아봤습니다.'
  },
  {
    id: 'secret-hunter',
    icon: '🥚',
    title: '비밀 수집가',
    description: '숨겨진 기록을 하나 발견했습니다.',
    secret: true
  },
  {
    id: 'egg-master',
    icon: '✨',
    title: '이스터에그 헌터',
    description: '숨겨진 기록을 모두 발견했습니다.',
    secret: true
  }
]

const RANDOM_EXCLUDED_TITLES = new Set([
  '서버규칙',
  '기초설정(뉴비필독)'
])

function emptyScores(): Record<ArchetypeId, number> {
  return {
    miner: 0,
    merchant: 0,
    gambler: 0,
    explorer: 0,
    strategist: 0,
    collector: 0
  }
}

function readVisitedPages() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(VISITED_PAGES_KEY) || '[]'
    )
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

export function WikiFunZone({ pages }: { pages: FunPage[] }) {
  const readyPages = useMemo(
    () => pages.filter((page) => page.status !== 'draft'),
    [pages]
  )
  const randomCandidates = useMemo(() => {
    const preferred = readyPages.filter(
      (page) => !RANDOM_EXCLUDED_TITLES.has(page.title)
    )
    return preferred.length ? preferred : readyPages
  }, [readyPages])

  const [panel, setPanel] = useState<Panel>(null)
  const [fortuneIndex, setFortuneIndex] = useState<number | null>(null)
  const [visitedIds, setVisitedIds] = useState<string[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizScores, setQuizScores] =
    useState<Record<ArchetypeId, number>>(emptyScores)
  const [quizResult, setQuizResult] = useState<ArchetypeId | null>(null)
  const [shareState, setShareState] = useState('')
  const [recommendedPage, setRecommendedPage] = useState<FunPage | null>(null)
  const [stats, setStats] = useState<WikiFunStats>({
    ...EMPTY_WIKI_FUN_STATS
  })
  const [secretZoneClicks, setSecretZoneClicks] = useState(0)
  const [fortuneOrbClicks, setFortuneOrbClicks] = useState(0)
  const [secretToast, setSecretToast] = useState('')

  const exploration = useMemo(
    () =>
      wikiExplorationProgress(
        visitedIds,
        readyPages.map((page) => page.pageId)
      ),
    [readyPages, visitedIds]
  )

  const visitedSet = useMemo(
    () => new Set(exploration.visited),
    [exploration.visited]
  )

  const unlockedAchievements = useMemo(
    () => unlockedWikiAchievementIds(exploration, stats),
    [exploration, stats]
  )
  const unlockedSet = useMemo(
    () => new Set(unlockedAchievements),
    [unlockedAchievements]
  )
  const currentTitle = useMemo(
    () => wikiTitleFromAchievements(unlockedAchievements),
    [unlockedAchievements]
  )

  const persistStats = (next: WikiFunStats) => {
    const normalized = normalizeWikiFunStats(next)
    setStats(normalized)
    window.localStorage.setItem(FUN_STATS_KEY, JSON.stringify(normalized))
  }

  const unlockEgg = (id: string, message: string) => {
    if (stats.eggs.includes(id)) return

    const next = {
      ...stats,
      eggs: [...stats.eggs, id]
    }
    persistStats(next)
    setSecretToast(message)
    window.setTimeout(() => setSecretToast(''), 2800)
    track('wiki_fun_easter_egg', { egg: id })
  }

  useEffect(() => {
    const today = seoulDateKey()
    let nextStats = readFunStats()

    try {
      const saved = JSON.parse(
        window.localStorage.getItem(FORTUNE_KEY) || 'null'
      ) as { date?: string; index?: number } | null
      if (
        saved?.date === today &&
        Number.isInteger(saved.index) &&
        typeof saved.index === 'number' &&
        saved.index >= 0 &&
        saved.index < FORTUNES.length
      ) {
        setFortuneIndex(saved.index)
        if (nextStats.fortuneDraws === 0) {
          nextStats = { ...nextStats, fortuneDraws: 1 }
          window.localStorage.setItem(
            FUN_STATS_KEY,
            JSON.stringify(nextStats)
          )
        }
      }
    } catch {}

    setStats(nextStats)

    const refreshVisited = () => setVisitedIds(readVisitedPages())
    refreshVisited()
    window.addEventListener('storage', refreshVisited)
    window.addEventListener('justserver3:visited-pages', refreshVisited)
    return () => {
      window.removeEventListener('storage', refreshVisited)
      window.removeEventListener('justserver3:visited-pages', refreshVisited)
    }
  }, [])

  useEffect(() => {
    if (!panel) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [panel])

  const openFortune = () => {
    setPanel('fortune')
    setShareState('')
    track('wiki_fun_open', { feature: 'daily-fortune' })
  }

  const drawFortune = () => {
    if (fortuneIndex !== null) return

    const values = new Uint32Array(1)
    window.crypto.getRandomValues(values)
    const index = values[0] % FORTUNES.length
    const today = seoulDateKey()

    window.localStorage.setItem(
      FORTUNE_KEY,
      JSON.stringify({ date: today, index })
    )
    setFortuneIndex(index)
    persistStats({
      ...stats,
      fortuneDraws: stats.fortuneDraws + 1
    })
    track('wiki_fun_complete', {
      feature: 'daily-fortune',
      result: String(index)
    })
  }

  const startQuiz = () => {
    setQuizIndex(0)
    setQuizScores(emptyScores())
    setQuizResult(null)
    setShareState('')
    setPanel('quiz')
    track('wiki_fun_open', { feature: 'survival-type' })
  }

  const answerQuiz = (type: ArchetypeId) => {
    const nextScores = { ...quizScores, [type]: quizScores[type] + 1 }
    setQuizScores(nextScores)

    if (quizIndex >= QUESTIONS.length - 1) {
      const result = highestScoreKey(nextScores, 'miner')
      setQuizResult(result)
      persistStats({
        ...stats,
        quizCompletions: stats.quizCompletions + 1
      })
      track('wiki_fun_complete', {
        feature: 'survival-type',
        result
      })
      return
    }

    setQuizIndex((value) => value + 1)
  }

  const shareResult = async (kind: 'fortune' | 'quiz') => {
    const fortune =
      fortuneIndex === null ? null : FORTUNES[fortuneIndex]
    const archetype = quizResult ? ARCHETYPES[quizResult] : null
    const text =
      kind === 'fortune' && fortune
        ? `오늘의 적자 운세: ${fortune.title} — ${fortune.message}`
        : archetype
          ? `나의 적자생존 유형은 ${archetype.name}! ${archetype.tagline}`
          : ''

    if (!text) return

    try {
      if (navigator.share) {
        await navigator.share({
          title: '그냥서버 : 적자생존 공식 위키',
          text,
          url: window.location.href
        })
        track('wiki_fun_share', { feature: kind })
        return
      }

      await navigator.clipboard.writeText(
        `${text}\n${window.location.href}`
      )
      setShareState('복사됨')
      track('wiki_fun_share', { feature: kind })
    } catch {
      setShareState('')
    }
  }

  const openRandom = () => {
    setRecommendedPage(null)
    setPanel('random')
    track('wiki_fun_open', { feature: 'random-guide' })
  }

  const rollRandom = () => {
    if (!randomCandidates.length) return

    const values = new Uint32Array(1)
    window.crypto.getRandomValues(values)
    let index = values[0] % randomCandidates.length

    if (
      recommendedPage &&
      randomCandidates.length > 1 &&
      randomCandidates[index]?.pageId === recommendedPage.pageId
    ) {
      index = (index + 1) % randomCandidates.length
    }

    const picked = randomCandidates[index]
    setRecommendedPage(picked)
    persistStats({
      ...stats,
      randomRolls: stats.randomRolls + 1
    })
    track('wiki_fun_complete', {
      feature: 'random-guide',
      category: picked.category || 'unknown'
    })
  }

  const openProgress = () => {
    setVisitedIds(readVisitedPages())
    setPanel('progress')
    track('wiki_fun_open', { feature: 'exploration' })
  }

  const openAchievements = () => {
    setVisitedIds(readVisitedPages())
    setPanel('achievements')
    track('wiki_fun_open', { feature: 'achievements' })
  }

  const hitPlayZoneSecret = () => {
    const next = secretZoneClicks + 1
    setSecretZoneClicks(next)
    if (next >= 7) {
      setSecretZoneClicks(0)
      unlockEgg('play-zone', '🥚 숨겨진 기록 발견 · PLAY ZONE을 두드린 자')
    }
  }

  const hitFortuneOrbSecret = () => {
    const next = fortuneOrbClicks + 1
    setFortuneOrbClicks(next)
    if (next >= 5) {
      setFortuneOrbClicks(0)
      unlockEgg('fortune-orb', '🥚 숨겨진 기록 발견 · 운명을 너무 많이 만진 자')
    }
  }

  const fortune =
    fortuneIndex === null ? null : FORTUNES[fortuneIndex]
  const result = quizResult ? ARCHETYPES[quizResult] : null
  const question = QUESTIONS[quizIndex]

  return (
    <section className="wiki-fun-zone" aria-labelledby="wiki-fun-zone-title">
      <div className="fun-zone-head">
        <div>
          <button
            className="fun-secret-trigger"
            type="button"
            aria-label="PLAY ZONE"
            onClick={hitPlayZoneSecret}
          >
            PLAY ZONE
          </button>
          <h2 id="wiki-fun-zone-title">정보만 보고 가기 아쉽다면?</h2>
          <span>
            가볍게 놀고, 가이드를 발견하고, 나만의 칭호도 모아보세요.
          </span>
        </div>
        <strong>5 FUN</strong>
      </div>

      <div className="fun-zone-grid">
        <button
          className="fun-card is-fortune"
          type="button"
          onClick={openFortune}
        >
          <span className="fun-card-icon" aria-hidden="true">🔮</span>
          <span className="fun-card-copy">
            <small>하루 한 번</small>
            <strong>오늘의 적자 운세</strong>
            <em>
              {fortune
                ? `오늘 결과 · ${fortune.title}`
                : '오늘은 어떤 생존 운일까요?'}
            </em>
          </span>
          <span className="fun-card-action">
            {fortune ? '다시 보기' : '운세 보기'} →
          </span>
        </button>

        <button
          className="fun-card is-quiz"
          type="button"
          onClick={startQuiz}
        >
          <span className="fun-card-icon" aria-hidden="true">🧬</span>
          <span className="fun-card-copy">
            <small>6문항</small>
            <strong>나는 어떤 생존형?</strong>
            <em>광부형부터 탐험가형까지 플레이 성향을 확인해보세요.</em>
          </span>
          <span className="fun-card-action">테스트 시작 →</span>
        </button>

        <button
          className="fun-card is-progress"
          type="button"
          onClick={openProgress}
        >
          <span className="fun-card-icon" aria-hidden="true">🏆</span>
          <span className="fun-card-copy">
            <small>위키 탐험도</small>
            <strong>{exploration.percent}% 발견</strong>
            <em>
              준비된 가이드 {exploration.count}/{exploration.total}개를 확인했습니다.
            </em>
            <span className="fun-progress-track" aria-hidden="true">
              <span style={{ width: `${exploration.percent}%` }} />
            </span>
          </span>
          <span className="fun-card-action">기록 보기 →</span>
        </button>

        <button
          className="fun-card is-random"
          type="button"
          onClick={openRandom}
        >
          <span className="fun-card-icon" aria-hidden="true">🎲</span>
          <span className="fun-card-copy">
            <small>결정 장애 탈출</small>
            <strong>오늘 뭐 하지?</strong>
            <em>준비된 가이드 중 하나를 랜덤으로 골라드립니다.</em>
          </span>
          <span className="fun-card-action">랜덤 추천 →</span>
        </button>

        <button
          className="fun-card is-achievements"
          type="button"
          onClick={openAchievements}
        >
          <span className="fun-card-icon" aria-hidden="true">🏅</span>
          <span className="fun-card-copy">
            <small>현재 칭호</small>
            <strong>{currentTitle}</strong>
            <em>
              업적 {unlockedAchievements.length}/{ACHIEVEMENTS.length}개 해금 · 비밀 기록도 있습니다.
            </em>
          </span>
          <span className="fun-card-action">업적 확인 →</span>
        </button>
      </div>

      {secretToast && (
        <div className="fun-secret-toast" role="status">
          {secretToast}
        </div>
      )}

      {panel && (
        <div
          className="fun-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setPanel(null)
          }}
        >
          <section
            className="fun-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === 'fortune'
                ? '오늘의 적자 운세'
                : panel === 'quiz'
                  ? '나는 어떤 생존형 테스트'
                  : panel === 'random'
                    ? '오늘 뭐 하지 랜덤 추천'
                    : panel === 'achievements'
                      ? '업적과 칭호'
                      : '위키 탐험도'
            }
          >
            <button
              className="fun-modal-close"
              type="button"
              aria-label="닫기"
              onClick={() => setPanel(null)}
            >
              ×
            </button>

            {panel === 'fortune' && (
              <div className="fun-modal-content">
                <span className="fun-modal-kicker">
                  DAILY FORTUNE · KST 00:00 RESET
                </span>
                <h2>오늘의 적자 운세</h2>

                {fortune ? (
                  <div className="fortune-result">
                    <button
                      className="fortune-secret-orb"
                      type="button"
                      aria-label="오늘의 운세 결과 아이콘"
                      onClick={hitFortuneOrbSecret}
                    >
                      {fortune.icon}
                    </button>
                    <p>오늘의 결과</p>
                    <h3>{fortune.title}</h3>
                    <strong>{fortune.message}</strong>
                    <small>{fortune.tip}</small>
                  </div>
                ) : (
                  <div className="fortune-ready">
                    <span aria-hidden="true">🔮</span>
                    <strong>오늘의 운세는 아직 봉인되어 있습니다.</strong>
                    <small>
                      결과는 자정 기준 하루 동안 유지됩니다. 재미로 가볍게 확인해주세요.
                    </small>
                    <button type="button" onClick={drawFortune}>
                      오늘의 운세 열기
                    </button>
                  </div>
                )}

                {fortune && (
                  <div className="fun-result-actions">
                    <button
                      type="button"
                      onClick={() => void shareResult('fortune')}
                    >
                      결과 공유
                    </button>
                    <button type="button" onClick={() => setPanel(null)}>
                      확인
                    </button>
                    {shareState && <span>{shareState}</span>}
                  </div>
                )}
              </div>
            )}

            {panel === 'quiz' && (
              <div className="fun-modal-content">
                <span className="fun-modal-kicker">SURVIVAL TYPE TEST</span>
                <h2>나는 어떤 생존형?</h2>

                {result ? (
                  <div className="quiz-result">
                    <span className="quiz-result-icon" aria-hidden="true">
                      {result.icon}
                    </span>
                    <p>나의 적자생존 유형</p>
                    <h3>{result.name}</h3>
                    <strong>{result.tagline}</strong>
                    <span>{result.description}</span>
                    <small>추천 플레이 · {result.recommendation}</small>

                    <div className="fun-result-actions">
                      <button
                        type="button"
                        onClick={() => void shareResult('quiz')}
                      >
                        결과 공유
                      </button>
                      <button type="button" onClick={startQuiz}>
                        다시 하기
                      </button>
                      {shareState && <span>{shareState}</span>}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="quiz-progress-row">
                      <span>
                        {quizIndex + 1} / {QUESTIONS.length}
                      </span>
                      <span className="quiz-progress-track">
                        <span
                          style={{
                            width: `${((quizIndex + 1) / QUESTIONS.length) * 100}%`
                          }}
                        />
                      </span>
                    </div>
                    <div className="quiz-question">
                      <h3>{question.question}</h3>
                      <div className="quiz-answers">
                        {question.answers.map((answer) => (
                          <button
                            key={answer.label}
                            type="button"
                            onClick={() => answerQuiz(answer.type)}
                          >
                            {answer.label}
                            <span>→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {panel === 'random' && (
              <div className="fun-modal-content">
                <span className="fun-modal-kicker">RANDOM PICK</span>
                <h2>오늘 뭐 하지?</h2>

                {recommendedPage ? (
                  <div className="random-result">
                    <span className="random-result-dice" aria-hidden="true">🎲</span>
                    <p>오늘의 랜덤 추천</p>
                    <h3>{recommendedPage.title}</h3>
                    <small>{recommendedPage.category || '적자생존 가이드'}</small>
                    <strong>
                      고민은 여기까지. 오늘은 이 가이드에서 시작해보세요.
                    </strong>

                    <div className="fun-result-actions">
                      <Link
                        href={withBasePath(
                          `/page/${recommendedPage.pageId}/`
                        )}
                        onClick={() => {
                          track('wiki_fun_random_navigate', {
                            category:
                              recommendedPage.category || 'unknown'
                          })
                          setPanel(null)
                        }}
                      >
                        이 가이드 보러가기
                      </Link>
                      <button type="button" onClick={rollRandom}>
                        다시 뽑기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="random-ready">
                    <span aria-hidden="true">🎲</span>
                    <strong>무엇을 할지 고민 중인가요?</strong>
                    <small>
                      현재 준비가 끝난 가이드 중 하나를 무작위로 골라드립니다.
                    </small>
                    <button
                      type="button"
                      onClick={rollRandom}
                      disabled={!randomCandidates.length}
                    >
                      랜덤 추천 받기
                    </button>
                  </div>
                )}
              </div>
            )}

            {panel === 'progress' && (
              <div className="fun-modal-content">
                <span className="fun-modal-kicker">WIKI EXPLORATION</span>
                <h2>위키 탐험도</h2>

                <div className="exploration-summary">
                  <div>
                    <strong>{exploration.percent}%</strong>
                    <small>발견 완료</small>
                  </div>
                  <p>
                    현재 준비가 완료된 가이드 {exploration.total}개 중{' '}
                    <strong>{exploration.count}개</strong>를 확인했습니다.
                  </p>
                </div>

                <div className="exploration-list">
                  {readyPages.map((page) => {
                    const normalized = page.pageId.replaceAll('-', '')
                    const visited = visitedSet.has(normalized)
                    return (
                      <Link
                        key={page.pageId}
                        href={withBasePath(`/page/${page.pageId}/`)}
                        className={visited ? 'is-visited' : ''}
                        onClick={() => {
                          track('wiki_fun_exploration_navigate', {
                            visited: visited ? 'yes' : 'no'
                          })
                          setPanel(null)
                        }}
                      >
                        <span>{visited ? '✓' : '○'}</span>
                        <strong>{page.title}</strong>
                        <small>{visited ? '확인 완료' : '아직 안 봄'}</small>
                      </Link>
                    )
                  })}
                </div>

                {exploration.total > 0 &&
                  exploration.count === exploration.total && (
                    <div className="exploration-complete">
                      🏆 준비된 가이드를 전부 발견했습니다. 적자생존 탐험 완료!
                    </div>
                  )}
              </div>
            )}

            {panel === 'achievements' && (
              <div className="fun-modal-content">
                <span className="fun-modal-kicker">ACHIEVEMENTS</span>
                <h2>업적 & 칭호</h2>

                <div className="achievement-title-card">
                  <span>현재 대표 칭호</span>
                  <strong>{currentTitle}</strong>
                  <small>
                    업적 {unlockedAchievements.length}/{ACHIEVEMENTS.length}개 해금
                  </small>
                </div>

                <div className="achievement-grid">
                  {ACHIEVEMENTS.map((achievement) => {
                    const unlocked = unlockedSet.has(achievement.id)
                    const hidden = achievement.secret && !unlocked

                    return (
                      <article
                        key={achievement.id}
                        className={unlocked ? 'is-unlocked' : ''}
                      >
                        <span className="achievement-icon" aria-hidden="true">
                          {hidden ? '❔' : achievement.icon}
                        </span>
                        <div>
                          <strong>
                            {hidden ? '??? 숨겨진 기록' : achievement.title}
                          </strong>
                          <small>
                            {hidden
                              ? 'PLAY ZONE 어딘가에 단서가 숨어 있습니다.'
                              : achievement.description}
                          </small>
                        </div>
                        <b>{unlocked ? '해금' : '잠김'}</b>
                      </article>
                    )
                  })}
                </div>

                <div className="achievement-stats">
                  <span>🔮 운세 {stats.fortuneDraws}회</span>
                  <span>🧬 테스트 {stats.quizCompletions}회</span>
                  <span>🎲 랜덤 {stats.randomRolls}회</span>
                  <span>🥚 비밀 {stats.eggs.length}/2</span>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
