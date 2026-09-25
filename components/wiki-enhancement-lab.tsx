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
    const master = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()

    master.gain.setValueAtTime(0.72, now)
    compressor.threshold.setValueAtTime(-20, now)
    compressor.knee.setValueAtTime(16, now)
    compressor.ratio.setValueAtTime(5, now)
    compressor.attack.setValueAtTime(0.004, now)
    compressor.release.setValueAtTime(0.2, now)
    compressor.connect(master)
    master.connect(ctx.destination)

    const tone = (
      frequency: number,
      start: number,
      duration: number,
      gainValue: number,
      type: OscillatorType = 'sine',
      endFrequency?: number
    ) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(frequency, now + start)
      if (endFrequency) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(35, endFrequency),
          now + start + duration
        )
      }
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, gainValue),
        now + start + 0.008
      )
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + start + duration
      )
      osc.connect(gain)
      gain.connect(compressor)
      osc.start(now + start)
      osc.stop(now + start + duration + 0.03)
    }

    const noise = (
      start: number,
      duration: number,
      gainValue: number,
      filterType: BiquadFilterType,
      frequency: number
    ) => {
      const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let index = 0; index < frames; index += 1) {
        data[index] = Math.random() * 2 - 1
      }

      const source = ctx.createBufferSource()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      source.buffer = buffer
      filter.type = filterType
      filter.frequency.setValueAtTime(frequency, now + start)
      filter.Q.setValueAtTime(0.8, now + start)
      gain.gain.setValueAtTime(Math.max(0.0002, gainValue), now + start)
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + start + duration
      )
      source.connect(filter)
      filter.connect(gain)
      gain.connect(compressor)
      source.start(now + start)
      source.stop(now + start + duration + 0.02)
    }

    const metalStrike = (
      base: number,
      start = 0,
      strength = 0.045,
      duration = 0.42
    ) => {
      const partials = [
        [1, 1],
        [1.47, 0.52],
        [2.13, 0.31],
        [2.73, 0.2]
      ] as const
      partials.forEach(([ratio, weight], index) => {
        tone(
          base * ratio,
          start + index * 0.004,
          duration * (1 - index * 0.08),
          strength * weight,
          index % 2 === 0 ? 'sine' : 'triangle'
        )
      })
      noise(start, 0.055, strength * 0.34, 'highpass', 1700)
    }

    if (kind === 'charge') {
      metalStrike(165, 0, 0.035, 0.24)
      tone(190, 0.04, 0.46, 0.023, 'sine', 390)
      tone(285, 0.16, 0.34, 0.014, 'triangle', 570)
    } else if (kind === 'success') {
      metalStrike(330, 0, 0.05, 0.48)
      tone(659, 0.07, 0.34, 0.032, 'sine')
      tone(988, 0.16, 0.38, 0.021, 'sine')
    } else if (kind === 'max') {
      metalStrike(392, 0, 0.056, 0.58)
      tone(523, 0.05, 0.5, 0.033, 'sine')
      tone(784, 0.14, 0.56, 0.03, 'sine')
      tone(1047, 0.28, 0.62, 0.025, 'sine')
      noise(0.08, 0.18, 0.012, 'highpass', 2600)
    } else if (kind === 'down') {
      metalStrike(180, 0, 0.045, 0.38)
      tone(310, 0.03, 0.42, 0.026, 'triangle', 145)
    } else if (kind === 'destroy') {
      metalStrike(108, 0, 0.064, 0.5)
      noise(0.02, 0.38, 0.052, 'lowpass', 1100)
      noise(0.07, 0.24, 0.025, 'highpass', 2200)
      tone(92, 0.02, 0.62, 0.038, 'sine', 48)
      tone(58, 0.12, 0.72, 0.025, 'triangle')
    } else {
      metalStrike(145, 0, 0.04, 0.32)
      tone(178, 0.02, 0.28, 0.019, 'triangle', 132)
    }

    window.setTimeout(() => {
      void ctx.close()
    }, 1500)
  } catch {}
}

function EnhancementPickaxe({
  level,
  broken
}: {
  level: number
  broken: boolean
}) {
  const enchanted = level >= 10 && !broken
  return (
    <img
      className="enhancement-pickaxe-image"
      src={
        enchanted
          ? 'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/enhancement-lab/enchanted-diamond-pickaxe.webp'
          : 'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/enhancement-lab/diamond-pickaxe.png'
      }
      alt={
        enchanted
          ? '인챈트된 다이아몬드 곡괭이'
          : '다이아몬드 곡괭이'
      }
      draggable={false}
      width={160}
      height={160}
    />
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
          <p>MINIGAME · 장비강화</p>
          <h2 id="enhancement-lab-title">강화 체험소</h2>
          <span>
            위키를 보다가 잠깐 즐길 수 있는 장비강화 체험입니다. +15까지 올려보세요.
          </span>
        </div>
        <div className="enhancement-head-actions">
          <span className="enhancement-sim-badge">체험용 시뮬레이션</span>
          <button
            type="button"
            aria-pressed={soundOn}
            onClick={() => setSoundOn((value) => !value)}
          >
            {soundOn ? '효과음 켬' : '효과음 끔'}
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
            <span className="enhancement-level-label">강화 단계</span>
            <strong>+{stats.level}</strong>
            <span className="enhancement-item-name">다이아몬드 곡괭이</span>
          </div>

          <div className="enhancement-item-stage">
            <div
              className="enhancement-slot-shell"
              data-enchanted={stats.level >= 10 && !broken ? 'true' : 'false'}
            >
              <div className="enhancement-slot">
                <div className="enhancement-slot-inner">
                  <div
                    className={
                      'enhancement-pickaxe ' + (broken ? 'is-broken' : '')
                    }
                  >
                    <EnhancementPickaxe
                      level={stats.level}
                      broken={broken}
                    />
                  </div>
                  {stats.level >= 10 && !broken && (
                    <div
                      className="enhancement-enchant-sheen"
                      aria-hidden="true"
                    />
                  )}
                  <span className="enhancement-slot-level">
                    +{stats.level}
                  </span>
                </div>
              </div>
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

            <div className="enhancement-item-tooltip">
              <strong>
                다이아몬드 곡괭이 +{stats.level}
              </strong>
              <span>
                {broken
                  ? '파괴됨 · 새 곡괭이를 받아 다시 도전할 수 있습니다.'
                  : stats.level >= 15
                    ? '최대 강화 · +15 달성'
                    : stats.level >= 10
                      ? '인챈트 활성 · 다음 성공 확률 ' + rule.success + '%'
                      : danger.label + ' 단계 · 다음 성공 확률 ' + rule.success + '%'}
              </span>
            </div>
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
