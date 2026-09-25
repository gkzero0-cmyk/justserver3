export function seoulDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || ''

  return `${get('year')}-${get('month')}-${get('day')}`
}

export function uniqueNormalizedPageIds(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => value.replaceAll('-', '').trim())
        .filter(Boolean)
    )
  ]
}

export function wikiExplorationProgress(
  visitedIds: string[],
  availableIds: string[]
) {
  const available = uniqueNormalizedPageIds(availableIds)
  const availableSet = new Set(available)
  const visited = uniqueNormalizedPageIds(visitedIds).filter((pageId) =>
    availableSet.has(pageId)
  )

  const total = available.length
  const count = visited.length
  const percent = total ? Math.round((count / total) * 100) : 0

  return { count, total, percent, visited }
}

export function highestScoreKey<T extends string>(
  scores: Record<T, number>,
  fallback: T
) {
  const entries = Object.entries(scores) as Array<[T, number]>
  return entries.reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    [fallback, scores[fallback] ?? 0] as [T, number]
  )[0]
}


export type WikiFunStats = {
  fortuneDraws: number
  quizCompletions: number
  randomRolls: number
  eggs: string[]
}

export type WikiAchievementId =
  | 'first-step'
  | 'guide'
  | 'explorer'
  | 'conqueror'
  | 'fortune'
  | 'analyst'
  | 'randomizer'
  | 'secret-hunter'
  | 'egg-master'

export const EMPTY_WIKI_FUN_STATS: WikiFunStats = {
  fortuneDraws: 0,
  quizCompletions: 0,
  randomRolls: 0,
  eggs: []
}

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0
}

export function normalizeWikiFunStats(value: unknown): WikiFunStats {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_WIKI_FUN_STATS }
  }

  const candidate = value as Partial<WikiFunStats>
  const eggs = Array.isArray(candidate.eggs)
    ? [
        ...new Set(
          candidate.eggs.filter(
            (egg): egg is string => typeof egg === 'string' && Boolean(egg)
          )
        )
      ]
    : []

  return {
    fortuneDraws: safeCount(candidate.fortuneDraws),
    quizCompletions: safeCount(candidate.quizCompletions),
    randomRolls: safeCount(candidate.randomRolls),
    eggs
  }
}

export function unlockedWikiAchievementIds(
  progress: { count: number; total: number; percent: number },
  stats: WikiFunStats
): WikiAchievementId[] {
  const unlocked: WikiAchievementId[] = []

  if (progress.count >= 1) unlocked.push('first-step')
  if (progress.count >= 3) unlocked.push('guide')
  if (progress.percent >= 50) unlocked.push('explorer')
  if (progress.total > 0 && progress.count >= progress.total) {
    unlocked.push('conqueror')
  }
  if (stats.fortuneDraws >= 1) unlocked.push('fortune')
  if (stats.quizCompletions >= 1) unlocked.push('analyst')
  if (stats.randomRolls >= 3) unlocked.push('randomizer')
  if (stats.eggs.length >= 1) unlocked.push('secret-hunter')
  if (stats.eggs.length >= 2) unlocked.push('egg-master')

  return unlocked
}

export function wikiTitleFromAchievements(
  ids: WikiAchievementId[]
) {
  const unlocked = new Set(ids)

  if (unlocked.has('conqueror')) return '위키 정복자'
  if (unlocked.has('egg-master')) return '이스터에그 헌터'
  if (unlocked.has('explorer')) return '적자생존 탐험가'
  if (unlocked.has('guide')) return '위키 길잡이'
  if (unlocked.has('analyst')) return '성향 분석가'
  if (unlocked.has('randomizer')) return '운명 결정사'
  if (unlocked.has('fortune')) return '운세 입문자'
  if (unlocked.has('first-step')) return '첫 발자국'

  return '신입 생존자'
}
