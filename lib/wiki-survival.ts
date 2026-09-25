import { seoulDateKey, uniqueNormalizedPageIds } from './wiki-fun'

export type SurvivalActivity = {
  visits: string[]
  fortune: number
  quiz: number
  random: number
  treasures: string[]
}

export type SurvivalRecord = {
  visitDays: string[]
  activityByDay: Record<string, SurvivalActivity>
}

export type DailyMissionId =
  | 'visit-one'
  | 'visit-two'
  | 'fortune'
  | 'quiz'
  | 'random'

export type WeeklyChallengeId =
  | 'week-visit-five'
  | 'week-fortune-three'
  | 'week-random-three'
  | 'week-quiz-one'
  | 'week-treasure-one'

export const EMPTY_SURVIVAL_ACTIVITY: SurvivalActivity = {
  visits: [],
  fortune: 0,
  quiz: 0,
  random: 0,
  treasures: []
}

export const EMPTY_SURVIVAL_RECORD: SurvivalRecord = {
  visitDays: [],
  activityByDay: {}
}

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0
}

function normalizeDayActivity(value: unknown): SurvivalActivity {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_SURVIVAL_ACTIVITY }
  }

  const candidate = value as Partial<SurvivalActivity>

  return {
    visits: uniqueNormalizedPageIds(
      Array.isArray(candidate.visits)
        ? candidate.visits.filter(
            (item): item is string => typeof item === 'string'
          )
        : []
    ),
    fortune: safeCount(candidate.fortune),
    quiz: safeCount(candidate.quiz),
    random: safeCount(candidate.random),
    treasures: uniqueNormalizedPageIds(
      Array.isArray(candidate.treasures)
        ? candidate.treasures.filter(
            (item): item is string => typeof item === 'string'
          )
        : []
    )
  }
}

export function normalizeSurvivalRecord(value: unknown): SurvivalRecord {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_SURVIVAL_RECORD, activityByDay: {} }
  }

  const candidate = value as Partial<SurvivalRecord>
  const activityByDay: Record<string, SurvivalActivity> = {}

  if (
    candidate.activityByDay &&
    typeof candidate.activityByDay === 'object'
  ) {
    for (const [date, activity] of Object.entries(candidate.activityByDay)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        activityByDay[date] = normalizeDayActivity(activity)
      }
    }
  }

  const visitDays = [
    ...new Set(
      Array.isArray(candidate.visitDays)
        ? candidate.visitDays.filter(
            (date): date is string =>
              typeof date === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(date)
          )
        : []
    )
  ].sort()

  return { visitDays, activityByDay }
}

export function recordSurvivalDay(
  record: SurvivalRecord,
  dateKey: string
): SurvivalRecord {
  const normalized = normalizeSurvivalRecord(record)
  if (normalized.visitDays.includes(dateKey)) return normalized

  return {
    ...normalized,
    visitDays: [...normalized.visitDays, dateKey].sort()
  }
}

export function recordSurvivalActivity(
  record: SurvivalRecord,
  dateKey: string,
  kind: 'visit' | 'fortune' | 'quiz' | 'random' | 'treasure',
  value?: string
): SurvivalRecord {
  const withDay = recordSurvivalDay(record, dateKey)
  const current =
    withDay.activityByDay[dateKey] || { ...EMPTY_SURVIVAL_ACTIVITY }
  const next: SurvivalActivity = {
    ...current,
    visits: [...current.visits],
    treasures: [...current.treasures]
  }

  if (kind === 'visit' && value) {
    next.visits = uniqueNormalizedPageIds([...next.visits, value])
  } else if (kind === 'treasure' && value) {
    next.treasures = uniqueNormalizedPageIds([...next.treasures, value])
  } else if (kind === 'fortune') {
    next.fortune += 1
  } else if (kind === 'quiz') {
    next.quiz += 1
  } else if (kind === 'random') {
    next.random += 1
  }

  return {
    ...withDay,
    activityByDay: {
      ...withDay.activityByDay,
      [dateKey]: next
    }
  }
}

function dateKeyDayNumber(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function dayNumberDateKey(dayNumber: number) {
  const date = new Date(dayNumber * 86400000)
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

export function survivalVisitStreak(
  visitDays: string[],
  todayKey = seoulDateKey()
) {
  const days = new Set(
    visitDays
      .map(dateKeyDayNumber)
      .filter((value) => Number.isFinite(value))
  )
  let cursor = dateKeyDayNumber(todayKey)
  let streak = 0

  while (days.has(cursor)) {
    streak += 1
    cursor -= 1
  }

  return streak
}

export function seoulWeekKey(value = new Date()) {
  const today = seoulDateKey(value)
  const dayNumber = dateKeyDayNumber(today)
  const weekday = new Date(dayNumber * 86400000).getUTCDay()
  const mondayOffset = weekday === 0 ? 6 : weekday - 1
  return dayNumberDateKey(dayNumber - mondayOffset)
}

function stableHash(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const DAILY_ROTATION: DailyMissionId[] = [
  'fortune',
  'quiz',
  'random',
  'visit-two'
]

export function dailyMissionIds(dateKey: string): DailyMissionId[] {
  const offset = stableHash(dateKey) % DAILY_ROTATION.length
  return [
    'visit-one',
    DAILY_ROTATION[offset],
    DAILY_ROTATION[(offset + 1) % DAILY_ROTATION.length]
  ]
}

export function dailyMissionProgress(
  id: DailyMissionId,
  activity: SurvivalActivity
) {
  if (id === 'visit-one') {
    return { current: Math.min(activity.visits.length, 1), target: 1 }
  }
  if (id === 'visit-two') {
    return { current: Math.min(activity.visits.length, 2), target: 2 }
  }
  if (id === 'fortune') {
    return { current: Math.min(activity.fortune, 1), target: 1 }
  }
  if (id === 'quiz') {
    return { current: Math.min(activity.quiz, 1), target: 1 }
  }
  return { current: Math.min(activity.random, 1), target: 1 }
}

const WEEKLY_ROTATION: WeeklyChallengeId[] = [
  'week-fortune-three',
  'week-random-three',
  'week-quiz-one',
  'week-treasure-one'
]

export function weeklyChallengeIds(
  weekKey: string
): WeeklyChallengeId[] {
  const offset = stableHash(weekKey) % WEEKLY_ROTATION.length
  return [
    'week-visit-five',
    WEEKLY_ROTATION[offset],
    WEEKLY_ROTATION[(offset + 1) % WEEKLY_ROTATION.length]
  ]
}

export function weeklyActivitySummary(
  record: SurvivalRecord,
  weekKey: string
) {
  const start = dateKeyDayNumber(weekKey)
  const visits: string[] = []
  const treasures: string[] = []
  let fortune = 0
  let quiz = 0
  let random = 0

  for (let offset = 0; offset < 7; offset += 1) {
    const date = dayNumberDateKey(start + offset)
    const activity = record.activityByDay[date]
    if (!activity) continue

    visits.push(...activity.visits)
    treasures.push(...activity.treasures)
    fortune += activity.fortune
    quiz += activity.quiz
    random += activity.random
  }

  return {
    visits: uniqueNormalizedPageIds(visits),
    treasures: uniqueNormalizedPageIds(treasures),
    fortune,
    quiz,
    random
  }
}

export function weeklyChallengeProgress(
  id: WeeklyChallengeId,
  summary: ReturnType<typeof weeklyActivitySummary>
) {
  if (id === 'week-visit-five') {
    return { current: Math.min(summary.visits.length, 5), target: 5 }
  }
  if (id === 'week-fortune-three') {
    return { current: Math.min(summary.fortune, 3), target: 3 }
  }
  if (id === 'week-random-three') {
    return { current: Math.min(summary.random, 3), target: 3 }
  }
  if (id === 'week-quiz-one') {
    return { current: Math.min(summary.quiz, 1), target: 1 }
  }
  return { current: Math.min(summary.treasures.length, 1), target: 1 }
}

export function treasurePageIds(
  availableIds: string[],
  maximum = 8
) {
  const normalized = uniqueNormalizedPageIds(availableIds)
  if (!normalized.length) return []

  const count = Math.min(
    maximum,
    Math.max(1, Math.round(normalized.length * 0.55))
  )

  return [...normalized]
    .sort(
      (left, right) =>
        stableHash(`treasure:${left}`) -
        stableHash(`treasure:${right}`)
    )
    .slice(0, count)
}

export function collectionProgress<
  T extends { pageId: string; category?: string | null }
>(pages: T[], visitedIds: string[]) {
  const visited = new Set(uniqueNormalizedPageIds(visitedIds))
  const groups = new Map<string, { count: number; total: number }>()

  for (const page of pages) {
    const category = page.category || '기타'
    const current = groups.get(category) || { count: 0, total: 0 }
    current.total += 1
    if (visited.has(page.pageId.replaceAll('-', ''))) {
      current.count += 1
    }
    groups.set(category, current)
  }

  return [...groups.entries()].map(([category, value]) => ({
    category,
    ...value,
    percent: value.total
      ? Math.round((value.count / value.total) * 100)
      : 0
  }))
}

export function dailyTipIndex(dateKey: string, count: number) {
  if (count <= 0) return -1
  return stableHash(`tip:${dateKey}`) % count
}
