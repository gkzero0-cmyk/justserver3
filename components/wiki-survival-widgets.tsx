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
import {
  readWikiStateValue,
  readWikiStringArray,
  writeWikiStateValue
} from '@/lib/wiki-client-state'

type WidgetPage = {
  pageId: string
  title: string
  status?: WikiContentStatus
}

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

function readFunStats(): WikiFunStats {
  try {
    return normalizeWikiFunStats(
      readWikiStateValue('funStats', null)
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
      readWikiStringArray('treasures').some(
        (id) => id.replaceAll('-', '') === normalizedCurrent
      )
    )
  }, [normalizedCurrent])

  const collect = useCallback(() => {
    if (!normalizedCurrent || targetIndex < 0) return

    const icon = ['💎', '🪙', '🔑', '📜'][targetIndex % 4]
    const existing = readWikiStringArray('treasures')
    const normalized = existing.map((id) => id.replaceAll('-', ''))
    if (!normalized.includes(normalizedCurrent)) {
      writeWikiStateValue(
        'treasures',
        [...existing, normalizedCurrent],
        'justserver3:treasure'
      )
    }

    let record
    try {
      record = normalizeSurvivalRecord(
        JSON.parse(
          JSON.stringify(readWikiStateValue('survivalRecord', null))
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
    writeWikiStateValue(
      'survivalRecord',
      next,
      'justserver3:survival-record'
    )

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
      const visited = readWikiStringArray('readPages')
      const stats = readFunStats()
      const progress = wikiExplorationProgress(visited, readyIds)
      const unlocked = unlockedWikiAchievementIds(progress, stats)
      const seen = new Set(readWikiStringArray('seenAchievements'))

      if (!initialized.current) {
        initialized.current = true
        writeWikiStateValue(
          'seenAchievements',
          [...new Set([...seen, ...unlocked])]
        )
        return
      }

      const newlyUnlocked = unlocked.filter((id) => !seen.has(id))
      if (!newlyUnlocked.length) return

      const nextSeen = [...new Set([...seen, ...newlyUnlocked])]
      writeWikiStateValue('seenAchievements', nextSeen)

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
