export const WIKI_STATE_KEY = 'justserver3-state-v2'
export const WIKI_STATE_EVENT = 'justserver3:state'

export type WikiStateField =
  | 'recentPages'
  | 'visitedPages'
  | 'readPages'
  | 'readMigration'
  | 'survivalRecord'
  | 'dailyFortune'
  | 'funStats'
  | 'treasures'
  | 'seenAchievements'
  | 'seenStoryChapters'
  | 'seenBossWeeks'
  | 'readingQuizzes'

type WikiClientState = {
  version: 2
  values: Partial<Record<WikiStateField, unknown>>
}

const LEGACY_KEYS: Record<WikiStateField, string> = {
  recentPages: 'justserver3-recent-pages-v1',
  visitedPages: 'justserver3-visited-pages-v1',
  readPages: 'justserver3-read-pages-v1',
  readMigration: 'justserver3-read-pages-migrated-v1',
  survivalRecord: 'justserver3-survival-record-v1',
  dailyFortune: 'justserver3-daily-fortune-v1',
  funStats: 'justserver3-fun-stats-v1',
  treasures: 'justserver3-treasures-v1',
  seenAchievements: 'justserver3-seen-achievements-v1',
  seenStoryChapters: 'justserver3-seen-story-chapters-v1',
  seenBossWeeks: 'justserver3-seen-boss-weeks-v1',
  readingQuizzes: 'justserver3-reading-quizzes-v1'
}

function parseStoredValue(raw: string) {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

function emptyState(): WikiClientState {
  return { version: 2, values: {} }
}

function loadState(): WikiClientState {
  if (typeof window === 'undefined') return emptyState()

  let state = emptyState()

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(WIKI_STATE_KEY) || 'null'
    ) as Partial<WikiClientState> | null

    if (
      parsed &&
      parsed.version === 2 &&
      parsed.values &&
      typeof parsed.values === 'object'
    ) {
      state = {
        version: 2,
        values: { ...parsed.values }
      }
    }
  } catch {}

  let migrated = false

  for (const [field, legacyKey] of Object.entries(LEGACY_KEYS) as [
    WikiStateField,
    string
  ][]) {
    if (state.values[field] !== undefined) continue
    const legacy = window.localStorage.getItem(legacyKey)
    if (legacy === null) continue
    state.values[field] = parseStoredValue(legacy)
    migrated = true
  }

  if (migrated) {
    try {
      window.localStorage.setItem(WIKI_STATE_KEY, JSON.stringify(state))
    } catch {}
  }

  return state
}

function persistState(state: WikiClientState) {
  try {
    window.localStorage.setItem(WIKI_STATE_KEY, JSON.stringify(state))
  } catch {}
}

function mirrorLegacy(field: WikiStateField, value: unknown) {
  const key = LEGACY_KEYS[field]

  try {
    window.localStorage.setItem(
      key,
      field === 'readMigration' && value
        ? '1'
        : typeof value === 'string'
          ? value
          : JSON.stringify(value)
    )
  } catch {}
}

function announce(eventName?: string) {
  window.dispatchEvent(new Event(WIKI_STATE_EVENT))
  if (eventName) window.dispatchEvent(new Event(eventName))
}

export function readWikiStateValue<T>(
  field: WikiStateField,
  fallback: T
): T {
  if (typeof window === 'undefined') return fallback
  const value = loadState().values[field]
  return value === undefined ? fallback : (value as T)
}

export function readWikiStringArray(field: WikiStateField) {
  const value = readWikiStateValue<unknown>(field, [])
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function writeWikiStateValue(
  field: WikiStateField,
  value: unknown,
  eventName?: string
) {
  if (typeof window === 'undefined') return

  const state = loadState()
  state.values[field] = value
  persistState(state)
  mirrorLegacy(field, value)
  announce(eventName)
}

export function removeWikiStateValue(
  field: WikiStateField,
  eventName?: string
) {
  if (typeof window === 'undefined') return

  const state = loadState()
  delete state.values[field]
  persistState(state)

  try {
    window.localStorage.removeItem(LEGACY_KEYS[field])
  } catch {}

  announce(eventName)
}
