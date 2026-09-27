export type EnhancementOutcome =
  | 'success'
  | 'fail'
  | 'down'
  | 'destroy'
  | 'max'

export type EnhancementLogEntry = {
  id: number
  outcome: EnhancementOutcome
  from: number
  to: number
}

export type EnhancementRun = {
  attempts: number
  successes: number
  failures: number
  downgrades: number
  destroyed: number
  best: number
}

export type EnhancementStats = {
  level: number
  attempts: number
  successes: number
  failures: number
  downgrades: number
  destroyed: number
  best: number
  maxWins: number
  broken: boolean
  history: EnhancementLogEntry[]
  run: EnhancementRun
}

export type EnhancementRule = {
  success: number
  fail: number
  down: number
  destroy: number
}

export const DEFAULT_ENHANCEMENT_STATS: EnhancementStats = {
  level: 0,
  attempts: 0,
  successes: 0,
  failures: 0,
  downgrades: 0,
  destroyed: 0,
  best: 0,
  maxWins: 0,
  broken: false,
  history: [],
  run: {
    attempts: 0,
    successes: 0,
    failures: 0,
    downgrades: 0,
    destroyed: 0,
    best: 0
  }
}

export const ENHANCEMENT_RULES: EnhancementRule[] = [
  { success: 82, fail: 18, down: 0, destroy: 0 },
  { success: 78, fail: 22, down: 0, destroy: 0 },
  { success: 74, fail: 26, down: 0, destroy: 0 },
  { success: 70, fail: 30, down: 0, destroy: 0 },
  { success: 64, fail: 36, down: 0, destroy: 0 },
  { success: 58, fail: 29, down: 13, destroy: 0 },
  { success: 54, fail: 29, down: 17, destroy: 0 },
  { success: 49, fail: 30, down: 18, destroy: 3 },
  { success: 44, fail: 30, down: 21, destroy: 5 },
  { success: 40, fail: 29, down: 24, destroy: 7 },
  { success: 35, fail: 29, down: 27, destroy: 9 },
  { success: 31, fail: 28, down: 30, destroy: 11 },
  { success: 27, fail: 27, down: 32, destroy: 14 },
  { success: 22, fail: 26, down: 34, destroy: 18 },
  { success: 18, fail: 24, down: 33, destroy: 25 }
]

export function normalizeEnhancementStats(value: unknown): EnhancementStats {
  if (!value || typeof value !== 'object') {
    return {
      ...DEFAULT_ENHANCEMENT_STATS,
      history: [],
      run: { ...DEFAULT_ENHANCEMENT_STATS.run }
    }
  }

  const raw = value as Partial<EnhancementStats>

  return {
    level: Math.max(0, Math.min(15, Number(raw.level) || 0)),
    attempts: Math.max(0, Number(raw.attempts) || 0),
    successes: Math.max(0, Number(raw.successes) || 0),
    failures: Math.max(0, Number(raw.failures) || 0),
    downgrades: Math.max(0, Number(raw.downgrades) || 0),
    destroyed: Math.max(0, Number(raw.destroyed) || 0),
    best: Math.max(0, Math.min(15, Number(raw.best) || 0)),
    maxWins: Math.max(0, Number(raw.maxWins) || 0),
    broken: Boolean(raw.broken),
    history: Array.isArray(raw.history)
      ? raw.history
          .filter((entry): entry is EnhancementLogEntry => {
            if (!entry || typeof entry !== 'object') return false
            const candidate = entry as Partial<EnhancementLogEntry>
            return (
              typeof candidate.id === 'number' &&
              ['success', 'fail', 'down', 'destroy', 'max'].includes(
                String(candidate.outcome)
              )
            )
          })
          .slice(0, 8)
          .map((entry) => ({
            id: Number(entry.id),
            outcome: entry.outcome,
            from: Math.max(0, Math.min(15, Number(entry.from) || 0)),
            to: Math.max(0, Math.min(15, Number(entry.to) || 0))
          }))
      : [],
    run:
      raw.run && typeof raw.run === 'object'
        ? {
            attempts: Math.max(0, Number(raw.run.attempts) || 0),
            successes: Math.max(0, Number(raw.run.successes) || 0),
            failures: Math.max(0, Number(raw.run.failures) || 0),
            downgrades: Math.max(0, Number(raw.run.downgrades) || 0),
            destroyed: Math.max(0, Number(raw.run.destroyed) || 0),
            best: Math.max(0, Math.min(15, Number(raw.run.best) || 0))
          }
        : {
            attempts: 0,
            successes: 0,
            failures: 0,
            downgrades: 0,
            destroyed: 0,
            best: Math.max(0, Math.min(15, Number(raw.level) || 0))
          }
  }
}

export function enhancementDanger(level: number) {
  if (level <= 4) return { label: '안정', tone: 'safe' }
  if (level <= 7) return { label: '주의', tone: 'caution' }
  if (level <= 10) return { label: '위험', tone: 'danger' }
  return { label: '극한', tone: 'extreme' }
}

export function enhancementStageLabel(level: number, broken = false) {
  if (broken) return '파괴'
  if (level >= 15) return '최대강화'
  if (level >= 12) return '극한강화'
  if (level >= 8) return '고강화'
  if (level >= 5) return '강화'
  return '기본'
}

export function enhancementResultMessage(
  outcome: EnhancementOutcome,
  from: number,
  to: number
) {
  if (outcome === 'success') return '강화 성공 · +' + from + ' → +' + to
  if (outcome === 'max') {
    return '강화 성공 · +' + from + ' → +15 · 최대강화 달성'
  }
  if (outcome === 'down') return '강화 하락 · +' + from + ' → +' + to
  if (outcome === 'destroy') {
    return '장비 파괴 · +' + from + ' 곡괭이가 부서졌습니다'
  }
  return '강화 실패 · +' + from + ' 유지'
}

export function enhancementOutcomeLabel(outcome: EnhancementOutcome) {
  if (outcome === 'success') return '성공'
  if (outcome === 'max') return '+15 달성'
  if (outcome === 'down') return '하락'
  if (outcome === 'destroy') return '파괴'
  return '실패'
}

export function enhancementAttemptDelay(level: number) {
  if (level >= 14) return 1450
  if (level >= 12) return 1200
  if (level >= 8) return 980
  if (level >= 5) return 800
  return 650
}

export function resolveEnhancementOutcome(
  level: number,
  roll: number
): { outcome: EnhancementOutcome; to: number } {
  const currentRule = ENHANCEMENT_RULES[Math.min(level, 14)]

  if (roll < currentRule.success) {
    const to = Math.min(15, level + 1)
    return { outcome: to === 15 ? 'max' : 'success', to }
  }

  if (roll < currentRule.success + currentRule.fail) {
    return { outcome: 'fail', to: level }
  }

  if (
    roll <
    currentRule.success + currentRule.fail + currentRule.down
  ) {
    return { outcome: 'down', to: Math.max(0, level - 1) }
  }

  return { outcome: 'destroy', to: 0 }
}
