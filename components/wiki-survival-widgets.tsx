'use client'

import { track } from '@vercel/analytics'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  normalizeWikiFunStats,
  unlockedWikiAchievementIds,
  wikiExplorationProgress,
  type WikiAchievementId,
  type WikiFunStats
} from '@/lib/wiki-fun'
import {
  normalizeSurvivalRecord,
  recordSurvivalActivity,
  seoulDateKey,
  treasurePageIds
} from '@/lib/wiki-survival'
import type { WikiContentStatus } from '@/lib/wiki-ux'

type WidgetPage = {
  pageId: string
  title: string
  status?: WikiContentStatus
}

const VISITED_PAGES_KEY = 'justserver3-read-pages-v1'
const FUN_STATS_KEY = 'justserver3-fun-stats-v1'
const SURVIVAL_RECORD_KEY = 'justserver3-survival-record-v1'
const TREASURES_KEY = 'justserver3-treasures-v1'
const SEEN_ACHIEVEMENTS_KEY = 'justserver3-seen-achievements-v1'

const ACHIEVEMENT_LABELS: Record<
  WikiAchievementId,
  { icon: string; title: string }
> = {
  'first-step': { icon: '👣', title: '첫 발자국' },
  guide: { icon: '🗺️', title: '위키 길잡이' },
  explorer: { icon: '🧭', title: '적자생존 탐험가' },
  conqueror: { icon: '👑', title: '위키 정복자' },
  fortune: { icon: '🔮', title: '운세 입문자' },
  analyst: { icon: '🧬', title: '성향 분석가' },
  randomizer: { icon: '🎲', title: '운명 결정사' },
  'secret-hunter': { icon: '🥚', title: '비밀 수집가' },
  'egg-master': { icon: '✨', title: '이스터에그 헌터' }
}

function readStringArray(key: string) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

function readFunStats(): WikiFunStats {
  try {
    return normalizeWikiFunStats(
      JSON.parse(window.localStorage.getItem(FUN_STATS_KEY) || 'null')
    )
  } catch {
    return normalizeWikiFunStats(null)
  }
}

export function WikiTreasureFind({
  currentPageId,
  pages
}: {
  currentPageId?: string | null
  pages: WidgetPage[]
}) {
  const readyIds = useMemo(
    () =>
      pages
        .filter((page) => page.status !== 'draft')
        .map((page) => page.pageId),
    [pages]
  )
  const targets = useMemo(() => treasurePageIds(readyIds), [readyIds])
  const normalizedCurrent = currentPageId?.replaceAll('-', '') || ''
  const targetIndex = targets.indexOf(normalizedCurrent)
  const [found, setFound] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setFound(
      readStringArray(TREASURES_KEY).some(
        (id) => id.replaceAll('-', '') === normalizedCurrent
      )
    )
  }, [normalizedCurrent])

  const collect = useCallback(() => {
    if (!normalizedCurrent || targetIndex < 0) return

    const icon = ['💎', '🪙', '🔑', '📜'][targetIndex % 4]
    const existing = readStringArray(TREASURES_KEY)
    const normalized = existing.map((id) => id.replaceAll('-', ''))
    if (!normalized.includes(normalizedCurrent)) {
      window.localStorage.setItem(
        TREASURES_KEY,
        JSON.stringify([...existing, normalizedCurrent])
      )
    }

    let record
    try {
      record = normalizeSurvivalRecord(
        JSON.parse(
          window.localStorage.getItem(SURVIVAL_RECORD_KEY) || 'null'
        )
      )
    } catch {
      record = normalizeSurvivalRecord(null)
    }

    const next = recordSurvivalActivity(
      record,
      seoulDateKey(),
      'treasure',
      normalizedCurrent
    )
    window.localStorage.setItem(SURVIVAL_RECORD_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('justserver3:treasure'))
    window.dispatchEvent(new Event('justserver3:survival-record'))

    setFound(true)
    setNotice(icon + ' 위키 보물을 발견했습니다!')
    window.setTimeout(() => setNotice(''), 2400)
    track('wiki_treasure_found', {
      slot: String(targetIndex + 1)
    })
  }, [normalizedCurrent, targetIndex])

  useEffect(() => {
    if (!normalizedCurrent || targetIndex < 0 || found) return

    let inserted: HTMLButtonElement | null = null
    let observer: MutationObserver | null = null

    const placeTreasure = () => {
      if (inserted?.isConnected) return true

      const root = document.querySelector<HTMLElement>('.notion-page-content')
      if (!root) return false

      const candidates = Array.from(
        root.querySelectorAll<HTMLElement>(
          'p, .notion-text, .notion-callout, ul, ol, h2, h3'
        )
      ).filter(
        (element) =>
          element.textContent?.trim() &&
          !element.closest('.wiki-inline-treasure')
      )
      if (!candidates.length) return false

      const base = Math.floor(candidates.length * 0.56)
      const offset = (targetIndex % 3) - 1
      const index = Math.max(
        0,
        Math.min(candidates.length - 1, base + offset)
      )
      const anchor = candidates[index]

      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'wiki-inline-treasure'
      button.setAttribute('aria-label', '본문에 숨겨진 위키 보물 발견')
      button.title = '뭔가 반짝입니다'
      button.innerHTML =
        '<span aria-hidden="true">✦</span><small>작은 반짝임 발견</small>'
      button.addEventListener('click', collect)
      anchor.insertAdjacentElement('afterend', button)
      inserted = button
      return true
    }

    if (!placeTreasure()) {
      const documentCard = document.querySelector('.document-card')
      if (documentCard) {
        observer = new MutationObserver(() => {
          if (placeTreasure()) observer?.disconnect()
        })
        observer.observe(documentCard, {
          childList: true,
          subtree: true
        })
      }
    }

    return () => {
      observer?.disconnect()
      if (inserted) {
        inserted.removeEventListener('click', collect)
        inserted.remove()
      }
    }
  }, [collect, found, normalizedCurrent, targetIndex])

  if (!notice) return null

  return (
    <div className="wiki-treasure-toast" role="status">
      {notice}
    </div>
  )
}

export function WikiAchievementNotifier({
  pages
}: {
  pages: WidgetPage[]
}) {
  const readyIds = useMemo(
    () =>
      pages
        .filter((page) => page.status !== 'draft')
        .map((page) => page.pageId),
    [pages]
  )
  const initialized = useRef(false)
  const [toast, setToast] = useState<WikiAchievementId | null>(null)

  useEffect(() => {
    const refresh = () => {
      const visited = readStringArray(VISITED_PAGES_KEY)
      const stats = readFunStats()
      const progress = wikiExplorationProgress(visited, readyIds)
      const unlocked = unlockedWikiAchievementIds(progress, stats)
      const seen = new Set(readStringArray(SEEN_ACHIEVEMENTS_KEY))

      if (!initialized.current) {
        initialized.current = true
        window.localStorage.setItem(
          SEEN_ACHIEVEMENTS_KEY,
          JSON.stringify([...new Set([...seen, ...unlocked])])
        )
        return
      }

      const newlyUnlocked = unlocked.filter((id) => !seen.has(id))
      if (!newlyUnlocked.length) return

      const nextSeen = [...new Set([...seen, ...newlyUnlocked])]
      window.localStorage.setItem(
        SEEN_ACHIEVEMENTS_KEY,
        JSON.stringify(nextSeen)
      )

      const first = newlyUnlocked[0]
      setToast(first)
      track('wiki_achievement_unlock', { achievement: first })

      window.setTimeout(() => {
        setToast((current) => (current === first ? null : current))
      }, 2600)
    }

    refresh()

    const events = [
      'storage',
      'justserver3:read-pages',
      'justserver3:fun-stats',
      'justserver3:survival-record',
      'justserver3:treasure'
    ]

    for (const event of events) window.addEventListener(event, refresh)
    return () => {
      for (const event of events) window.removeEventListener(event, refresh)
    }
  }, [readyIds])

  if (!toast) return null

  const info = ACHIEVEMENT_LABELS[toast]

  return (
    <div className="wiki-achievement-toast" role="status">
      <span aria-hidden="true">{info.icon}</span>
      <div>
        <small>ACHIEVEMENT UNLOCKED</small>
        <strong>{info.title}</strong>
      </div>
      <b aria-hidden="true">✦</b>
    </div>
  )
}
