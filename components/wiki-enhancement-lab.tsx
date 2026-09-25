'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import {
  readWikiStateValue,
  writeWikiStateValue
} from '@/lib/wiki-client-state'
import type { WikiContentStatus } from '@/lib/wiki-content-status'
import { withBasePath } from '@/lib/url-utils'

type EnhancementPage = {
  pageId: string
  title: string
  status?: WikiContentStatus
}

type EnhancementOutcome = 'success' | 'fail' | 'down' | 'destroy' | 'max'

type EnhancementStats = {
  level: number
  attempts: number
  successes: number
  failures: number
  downgrades: number
  destroyed: number
  best: number
  maxWins: number
  broken: boolean
}

type EnhancementRule = {
  success: number
  fail: number
  down: number
  destroy: number
}

const DEFAULT_STATS: EnhancementStats = {
  level: 0,
  attempts: 0,
  successes: 0,
  failures: 0,
  downgrades: 0,
  destroyed: 0,
  best: 0,
  maxWins: 0,
  broken: false
}

const RULES: EnhancementRule[] = [
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

function normalizeStats(value: unknown): EnhancementStats {
  if (!value || typeof value !== 'object') return { ...DEFAULT_STATS }
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
    broken: Boolean(raw.broken)
  }
}

function dangerLabel(level: number) {
  if (level <= 4) return { label: '안정', tone: 'safe' }
  if (level <= 7) return { label: '주의', tone: 'caution' }
  if (level <= 10) return { label: '위험', tone: 'danger' }
  return { label: '극한', tone: 'extreme' }
}

function resultMessage(outcome: EnhancementOutcome, from: number, to: number) {
  if (outcome === 'success') return '강화 성공 · +' + from + ' → +' + to
  if (outcome === 'max') return '+15 달성 · 전설적인 강화에 성공했습니다!'
  if (outcome === 'down') return '강화 하락 · +' + from + ' → +' + to
  if (outcome === 'destroy') {
    return '장비 파괴 · +' + from + ' 곡괭이가 산산이 부서졌습니다'
  }
  return '강화 실패 · +' + from + ' 유지'
}

function randomPercent() {
  const values = new Uint32Array(1)
  window.crypto.getRandomValues(values)
  return (values[0] / 0xffffffff) * 100
}

function playTone(
  kind: 'charge' | 'success' | 'fail' | 'down' | 'destroy' | 'max'
) {
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const beep = (
      frequency: number,
      start: number,
      duration: number,
      gainValue: number,
      type: OscillatorType = 'sine'
    ) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(frequency, now + start)
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(gainValue, now + start + 0.015)
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + start + duration
      )
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + duration + 0.03)
    }

    if (kind === 'charge') {
      beep(290, 0, .12, .055, 'triangle')
      beep(390, .09, .15, .045, 'triangle')
      beep(520, .19, .18, .04, 'sine')
    } else if (kind === 'success') {
      beep(520, 0, .18, .06)
      beep(660, .08, .2, .055)
      beep(880, .18, .28, .05)
    } else if (kind === 'max') {
      beep(523, 0, .26, .065)
      beep(659, .08, .28, .06)
      beep(784, .18, .34, .06)
      beep(1047, .34, .45, .055)
    } else if (kind === 'down') {
      beep(360, 0, .18, .055, 'sawtooth')
      beep(250, .1, .24, .05, 'triangle')
    } else if (kind === 'destroy') {
      beep(150, 0, .32, .075, 'sawtooth')
      beep(92, .05, .5, .07, 'square')
      beep(58, .18, .55, .055, 'triangle')
    } else {
      beep(250, 0, .14, .05, 'square')
      beep(190, .08, .2, .04, 'triangle')
    }

    window.setTimeout(() => {
      void ctx.close()
    }, 1200)
  } catch {}
}

function PixelPickaxe() {
  return (
    <svg
      viewBox="0 0 160 160"
      className="enhancement-pickaxe-svg"
      role="img"
      aria-label="픽셀풍 다이아몬드 곡괭이"
    >
      <g shapeRendering="crispEdges">
        <path
          d="M22 30h56v10H44v10H34v10H24V50H14V40h8z"
          className="pickaxe-head-light"
        />
        <path
          d="M78 30h30v10h12v10h10v10h-20V50H78z"
          className="pickaxe-head-dark"
        />
        <path d="M67 45h18v18H67z" className="pickaxe-joint" />
        <path
          d="M73 59h14v14H73zM66 70h14v14H66zM59 81h14v14H59zM52 92h14v14H52zM45 103h14v14H45zM38 114h14v14H38z"
          className="pickaxe-handle"
        />
        <path
          d="M80 73h7v7h-7zM73 84h7v7h-7zM66 95h7v7h-7zM59 106h7v7h-7zM52 117h7v7h-7z"
          className="pickaxe-handle-light"
        />
        <path
          d="M22 40h44v8H32v8H22zM88 38h18v8h10v8h-20v-8h-8z"
          className="pickaxe-shine"
        />
      </g>
    </svg>
  )
}

export function WikiEnhancementLab({
  pages
}: {
  pages: EnhancementPage[]
}) {
  const [stats, setStats] = useState<EnhancementStats>(DEFAULT_STATS)
  const [ready, setReady] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [broken, setBroken] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [outcome, setOutcome] = useState<EnhancementOutcome | null>(null)
  const [message, setMessage] = useState(
    '강화 버튼을 눌러 +15에 도전해보세요.'
  )
  const timerRef = useRef<number | null>(null)

  const rule = RULES[Math.min(stats.level, 14)]
  const danger = dangerLabel(stats.level)
  const enhancementPage = pages.find((page) => page.title === '장비강화')
  const repairPage = pages.find((page) => page.title === '장비수리')
  const faqPage = pages.find((page) => page.title === '많이 물어보는 것')

  const glowTier =
    stats.level >= 15
      ? 'legendary'
      : stats.level >= 12
        ? 'extreme'
        : stats.level >= 8
          ? 'high'
          : stats.level >= 5
            ? 'mid'
            : 'base'

  const successRateLabel = useMemo(
    () => (stats.level >= 15 ? 'MAX' : String(rule.success) + '%'),
    [rule.success, stats.level]
  )

  useEffect(() => {
    const saved = normalizeStats(
      readWikiStateValue('enhancementLab', DEFAULT_STATS)
    )
    setStats(saved)
    setBroken(saved.broken)
    setReady(true)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const persist = (next: EnhancementStats) => {
    setStats(next)
    writeWikiStateValue(
      'enhancementLab',
      next,
      'justserver3:enhancement-lab'
    )
  }

  const vibrate = (pattern: number | number[]) => {
    try {
      navigator.vibrate?.(pattern)
    } catch {}
  }

  const enhance = () => {
    if (!ready || animating || broken || stats.level >= 15) return

    const from = stats.level
    const currentRule = RULES[from]
    const roll = randomPercent()

    let nextOutcome: EnhancementOutcome = 'fail'
    let to = from

    if (roll < currentRule.success) {
      to = Math.min(15, from + 1)
      nextOutcome = to === 15 ? 'max' : 'success'
    } else if (roll < currentRule.success + currentRule.fail) {
      nextOutcome = 'fail'
    } else if (
      roll <
      currentRule.success + currentRule.fail + currentRule.down
    ) {
      to = Math.max(0, from - 1)
      nextOutcome = 'down'
    } else {
      nextOutcome = 'destroy'
      to = 0
    }

    setAnimating(true)
    setOutcome(null)
    setMessage('강화 에너지를 주입하는 중…')
    if (soundOn) playTone('charge')
    vibrate(18)

    track('wiki_enhancement_attempt', {
      from_level: String(from),
      risk: dangerLabel(from).tone
    })

    timerRef.current = window.setTimeout(() => {
      const next: EnhancementStats = {
        ...stats,
        attempts: stats.attempts + 1,
        successes:
          stats.successes +
          (nextOutcome === 'success' || nextOutcome === 'max' ? 1 : 0),
        failures: stats.failures + (nextOutcome === 'fail' ? 1 : 0),
        downgrades: stats.downgrades + (nextOutcome === 'down' ? 1 : 0),
        destroyed: stats.destroyed + (nextOutcome === 'destroy' ? 1 : 0),
        best: Math.max(stats.best, nextOutcome === 'destroy' ? from : to),
        maxWins: stats.maxWins + (nextOutcome === 'max' ? 1 : 0),
        level: nextOutcome === 'destroy' ? from : to,
        broken: nextOutcome === 'destroy'
      }

      persist(next)
      setOutcome(nextOutcome)
      setMessage(resultMessage(nextOutcome, from, to))
      setAnimating(false)

      if (nextOutcome === 'destroy') {
        setBroken(true)
        vibrate([80, 35, 140])
      } else if (nextOutcome === 'down') {
        vibrate([45, 25, 45])
      } else if (nextOutcome === 'success' || nextOutcome === 'max') {
        vibrate(nextOutcome === 'max' ? [25, 20, 25, 20, 70] : 35)
      }

      if (soundOn) playTone(nextOutcome)

      track('wiki_enhancement_result', {
        result: nextOutcome,
        from_level: String(from),
        to_level: String(to)
      })
    }, 920)
  }

  const replaceBrokenPickaxe = () => {
    const next = { ...stats, level: 0, broken: false }
    persist(next)
    setBroken(false)
    setOutcome(null)
    setMessage(
      '새 다이아몬드 곡괭이를 지급했습니다. 다시 도전해보세요.'
    )
    track('wiki_enhancement_replace')
  }

  const startNewRun = () => {
    const next = { ...stats, level: 0, broken: false }
    persist(next)
    setBroken(false)
    setOutcome(null)
    setMessage('새 강화 도전을 시작합니다.')
    track('wiki_enhancement_restart')
  }

  return (
    <section
      className="wiki-enhancement-lab"
      id="enhancement-lab"
      aria-labelledby="enhancement-lab-title"
    >
      <header className="enhancement-lab-head">
        <div>
          <p>ENHANCEMENT FORGE</p>
          <h2 id="enhancement-lab-title">강화 체험소</h2>
          <span>
            다이아몬드 곡괭이를 +15까지 강화해보세요. 성공·실패·하락·파괴가
            기다리고 있습니다.
          </span>
        </div>
        <div className="enhancement-head-actions">
          <span className="enhancement-sim-badge">체험용 시뮬레이션</span>
          <button
            type="button"
            aria-pressed={soundOn}
            onClick={() => setSoundOn((value) => !value)}
          >
            {soundOn ? '🔊 효과음 ON' : '🔇 효과음 OFF'}
          </button>
        </div>
      </header>

      <div className="enhancement-main-grid">
        <div
          className="enhancement-forge"
          data-tier={glowTier}
          data-state={
            broken
              ? 'destroy'
              : animating
                ? 'charging'
                : outcome || 'idle'
          }
        >
          <div className="enhancement-forge-grid" aria-hidden="true" />

          <div className="enhancement-level-row">
            <span className="enhancement-level-label">CURRENT</span>
            <strong>+{stats.level}</strong>
            <span className="enhancement-item-name">다이아몬드 곡괭이</span>
          </div>

          <div className="enhancement-item-stage">
            <div className="enhancement-aura" aria-hidden="true" />
            <div className="enhancement-ring ring-one" aria-hidden="true" />
            <div className="enhancement-ring ring-two" aria-hidden="true" />
            <div
              className={
                'enhancement-pickaxe ' + (broken ? 'is-broken' : '')
              }
            >
              <PixelPickaxe />
            </div>
            <div className="enhancement-particles" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <i
                  key={index}
                  style={{ '--i': index } as CSSProperties}
                />
              ))}
            </div>
            {broken && (
              <div className="enhancement-shards" aria-hidden="true">
                {Array.from({ length: 9 }, (_, index) => (
                  <i
                    key={index}
                    style={{ '--i': index } as CSSProperties}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="enhancement-result"
            data-outcome={outcome || 'idle'}
          >
            <span aria-hidden="true">
              {outcome === 'max'
                ? '✦'
                : outcome === 'success'
                  ? '◆'
                  : outcome === 'down'
                    ? '↓'
                    : outcome === 'destroy'
                      ? '✕'
                      : outcome === 'fail'
                        ? '·'
                        : '◇'}
            </span>
            <strong>{message}</strong>
          </div>

          <div className="enhancement-action-zone">
            {broken ? (
              <button
                type="button"
                className="enhancement-primary is-replace"
                onClick={replaceBrokenPickaxe}
              >
                새 곡괭이 받기
                <span>0강부터 재도전</span>
              </button>
            ) : stats.level >= 15 ? (
              <button
                type="button"
                className="enhancement-primary is-max"
                onClick={startNewRun}
              >
                +15 달성!
                <span>새 강화 도전 시작</span>
              </button>
            ) : (
              <button
                type="button"
                className="enhancement-primary"
                disabled={!ready || animating}
                onClick={enhance}
              >
                {animating ? '강화 중…' : '강화하기'}
                <span>
                  +{stats.level} → +{stats.level + 1}
                </span>
              </button>
            )}
          </div>
        </div>

        <aside className="enhancement-side">
          <section className="enhancement-probability">
            <div className="enhancement-panel-title">
              <div>
                <small>CURRENT ODDS</small>
                <strong>현재 강화 확률</strong>
              </div>
              <span data-tone={danger.tone}>{danger.label}</span>
            </div>

            {stats.level < 15 ? (
              <div className="enhancement-odds-grid">
                <div data-kind="success">
                  <small>성공</small>
                  <strong>{successRateLabel}</strong>
                </div>
                <div data-kind="fail">
                  <small>실패</small>
                  <strong>{rule.fail}%</strong>
                </div>
                <div data-kind="down">
                  <small>하락</small>
                  <strong>{rule.down}%</strong>
                </div>
                <div data-kind="destroy">
                  <small>파괴</small>
                  <strong>{rule.destroy}%</strong>
                </div>
              </div>
            ) : (
              <div className="enhancement-max-panel">
                <strong>MAX +15</strong>
                <span>최고 단계에 도달했습니다.</span>
              </div>
            )}

            <p>
              이 확률은 <strong>위키 미니게임 전용</strong>입니다. 실제 서버의
              장비강화 수치나 규칙을 의미하지 않습니다.
            </p>
          </section>

          <section className="enhancement-records">
            <div className="enhancement-panel-title">
              <div>
                <small>YOUR RECORD</small>
                <strong>강화 기록</strong>
              </div>
              <b>BEST +{stats.best}</b>
            </div>

            <div className="enhancement-record-grid">
              <span>
                <small>총 시도</small>
                <strong>{stats.attempts}</strong>
              </span>
              <span>
                <small>성공</small>
                <strong>{stats.successes}</strong>
              </span>
              <span>
                <small>하락</small>
                <strong>{stats.downgrades}</strong>
              </span>
              <span>
                <small>파괴</small>
                <strong>{stats.destroyed}</strong>
              </span>
              <span>
                <small>15강 달성</small>
                <strong>{stats.maxWins}</strong>
              </span>
              <span>
                <small>실패</small>
                <strong>{stats.failures}</strong>
              </span>
            </div>
          </section>

          <section className="enhancement-links">
            <div className="enhancement-panel-title">
              <div>
                <small>WIKI LINKS</small>
                <strong>관련 가이드</strong>
              </div>
            </div>
            <div>
              {enhancementPage && (
                <Link
                  href={withBasePath('/page/' + enhancementPage.pageId + '/')}
                  data-wiki-event="wiki_enhancement_guide"
                  data-wiki-section="enhancement-lab"
                  data-wiki-target="장비강화"
                  data-wiki-status={enhancementPage.status || 'unknown'}
                >
                  <span>⚒</span>
                  <strong>장비강화 가이드</strong>
                  <b>→</b>
                </Link>
              )}
              {repairPage && (
                <Link
                  href={withBasePath('/page/' + repairPage.pageId + '/')}
                  data-wiki-event="wiki_enhancement_guide"
                  data-wiki-section="enhancement-lab"
                  data-wiki-target="장비수리"
                  data-wiki-status={repairPage.status || 'unknown'}
                >
                  <span>🛠</span>
                  <strong>장비수리 가이드</strong>
                  <b>→</b>
                </Link>
              )}
              {faqPage && (
                <Link
                  href={withBasePath('/page/' + faqPage.pageId + '/')}
                  data-wiki-event="wiki_enhancement_guide"
                  data-wiki-section="enhancement-lab"
                  data-wiki-target="FAQ"
                  data-wiki-status={faqPage.status || 'unknown'}
                >
                  <span>?</span>
                  <strong>자주 묻는 질문</strong>
                  <b>→</b>
                </Link>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
