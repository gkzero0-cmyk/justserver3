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

type EnhancementLogEntry = {
  id: number
  outcome: EnhancementOutcome
  from: number
  to: number
}

type EnhancementRun = {
  attempts: number
  successes: number
  failures: number
  downgrades: number
  destroyed: number
  best: number
}

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
  history: EnhancementLogEntry[]
  run: EnhancementRun
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
    broken: Boolean(raw.broken),
    history: Array.isArray(raw.history)
      ? raw.history
          .filter((entry): entry is EnhancementLogEntry => {
            if (!entry || typeof entry !== 'object') return false
            const value = entry as Partial<EnhancementLogEntry>
            return (
              typeof value.id === 'number' &&
              ['success', 'fail', 'down', 'destroy', 'max'].includes(
                String(value.outcome)
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

function dangerLabel(level: number) {
  if (level <= 4) return { label: '안정', tone: 'safe' }
  if (level <= 7) return { label: '주의', tone: 'caution' }
  if (level <= 10) return { label: '위험', tone: 'danger' }
  return { label: '극한', tone: 'extreme' }
}

function enhancementStageLabel(level: number, broken = false) {
  if (broken) return '파괴'
  if (level >= 15) return '최대강화'
  if (level >= 12) return '극한강화'
  if (level >= 8) return '고강화'
  if (level >= 5) return '강화'
  return '기본'
}

function resultMessage(outcome: EnhancementOutcome, from: number, to: number) {
  if (outcome === 'success') return '강화 성공 · +' + from + ' → +' + to
  if (outcome === 'max') return '강화 성공 · +' + from + ' → +15 · 최대강화 달성'
  if (outcome === 'down') return '강화 하락 · +' + from + ' → +' + to
  if (outcome === 'destroy') {
    return '장비 파괴 · +' + from + ' 곡괭이가 부서졌습니다'
  }
  return '강화 실패 · +' + from + ' 유지'
}

function outcomeLabel(outcome: EnhancementOutcome) {
  if (outcome === 'success') return '성공'
  if (outcome === 'max') return '+15 달성'
  if (outcome === 'down') return '하락'
  if (outcome === 'destroy') return '파괴'
  return '실패'
}

function attemptDelay(level: number) {
  if (level >= 14) return 1450
  if (level >= 12) return 1200
  if (level >= 8) return 980
  if (level >= 5) return 800
  return 650
}

let activeEnhancementAudioContext: AudioContext | null = null
let activeEnhancementAudioCloseTimer: number | null = null

function randomPercent() {
  const values = new Uint32Array(1)
  window.crypto.getRandomValues(values)
  return (values[0] / 0xffffffff) * 100
}

function playTone(
  kind: 'charge' | 'success' | 'fail' | 'down' | 'destroy' | 'max',
  level = 0,
  volume = 0.75
) {
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return

    if (
      activeEnhancementAudioContext &&
      activeEnhancementAudioContext.state !== 'closed'
    ) {
      void activeEnhancementAudioContext.close().catch(() => {})
    }
    if (activeEnhancementAudioCloseTimer) {
      window.clearTimeout(activeEnhancementAudioCloseTimer)
    }

    const ctx = new AudioContextClass()
    activeEnhancementAudioContext = ctx
    const now = ctx.currentTime
    const intensity = Math.max(0, Math.min(15, level))
    const master = ctx.createGain()
    const compressor = ctx.createDynamicsCompressor()

    const normalizedVolume = Math.max(0, Math.min(1, volume))
    master.gain.setValueAtTime(0.58 * normalizedVolume, now)
    compressor.threshold.setValueAtTime(-22, now)
    compressor.knee.setValueAtTime(18, now)
    compressor.ratio.setValueAtTime(7, now)
    compressor.attack.setValueAtTime(0.002, now)
    compressor.release.setValueAtTime(0.18, now)
    compressor.connect(master)
    master.connect(ctx.destination)

    const resonator = (
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
          Math.max(34, endFrequency),
          now + start + duration
        )
      }
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, gainValue),
        now + start + 0.004
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

    const impactNoise = (
      start: number,
      duration: number,
      gainValue: number,
      frequency: number,
      filterType: BiquadFilterType = 'bandpass'
    ) => {
      const frames = Math.max(1, Math.floor(ctx.sampleRate * duration))
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let index = 0; index < frames; index += 1) {
        const decay = 1 - index / frames
        data[index] = (Math.random() * 2 - 1) * decay
      }

      const source = ctx.createBufferSource()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      source.buffer = buffer
      filter.type = filterType
      filter.frequency.setValueAtTime(frequency, now + start)
      filter.Q.setValueAtTime(filterType === 'bandpass' ? 1.7 : 0.8, now + start)
      gain.gain.setValueAtTime(Math.max(0.0002, gainValue), now + start)
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + start + duration
      )
      source.connect(filter)
      filter.connect(gain)
      gain.connect(compressor)
      source.start(now + start)
      source.stop(now + start + duration + 0.025)
    }

    const hammerHit = (
      start = 0,
      strength = 1,
      ring = 1,
      dull = false
    ) => {
      const body = 74 + Math.min(18, intensity * 1.15)
      impactNoise(start, 0.045, 0.072 * strength, dull ? 610 : 980)
      impactNoise(start + 0.004, 0.09, 0.03 * strength, 250, 'lowpass')
      resonator(body, start, 0.2, 0.055 * strength, 'triangle')
      const metallicPartials = dull
        ? [238, 356, 514]
        : [286, 431, 638, 917]
      metallicPartials.forEach((frequency, index) => {
        resonator(
          frequency + intensity * (index + 1) * 1.8,
          start + 0.006 + index * 0.003,
          (0.22 + index * 0.07) * ring,
          (0.022 / (index + 1)) * strength,
          index % 2 ? 'triangle' : 'sine'
        )
      })
    }

    if (kind === 'charge') {
      // Preparation cue: metal placed on an anvil + a light tool tap.
      // Keep it intentionally softer and shorter than every result sound.
      impactNoise(0, 0.035, 0.026, 1380, 'bandpass')
      resonator(118, 0, 0.12, 0.017, 'triangle', 92)
      impactNoise(0.055, 0.05, 0.01, 1820, 'highpass')
      if (intensity >= 8) {
        resonator(54, 0.09, 0.32, 0.007, 'sine', 62)
      }
    } else if (kind === 'success') {
      // Clear forged result: crisp hammer hit with an open metallic ring.
      hammerHit(0, 0.98, 1.05, false)
      resonator(326, 0.018, 0.34, 0.012, 'sine', 342)
      if (intensity >= 8) {
        resonator(196, 0.08, 0.38, 0.008, 'sine', 214)
      }
    } else if (kind === 'max') {
      hammerHit(0, 1.14, 1.18, false)
      hammerHit(0.17, 0.5, 0.72, false)
      resonator(174, 0.09, 0.66, 0.014, 'sine', 205)
      impactNoise(0.18, 0.22, 0.01, 720, 'bandpass')
    } else if (kind === 'down') {
      hammerHit(0, 0.78, 0.48, true)
      resonator(142, 0.035, 0.5, 0.024, 'triangle', 58)
      impactNoise(0.13, 0.12, 0.014, 260, 'lowpass')
    } else if (kind === 'destroy') {
      hammerHit(0, 1.2, 0.46, true)
      impactNoise(0.025, 0.34, 0.06, 940, 'bandpass')
      impactNoise(0.06, 0.42, 0.045, 480, 'lowpass')
      resonator(68, 0.015, 0.72, 0.042, 'sine', 38)
      resonator(43, 0.09, 0.74, 0.024, 'triangle')
    } else {
      // Failure: a dead, closed hit with almost no ringing.
      impactNoise(0, 0.065, 0.058, 430, 'lowpass')
      resonator(92, 0.005, 0.18, 0.036, 'triangle', 58)
      impactNoise(0.025, 0.07, 0.018, 760, 'bandpass')
    }

    activeEnhancementAudioCloseTimer = window.setTimeout(() => {
      if (activeEnhancementAudioContext === ctx) {
        activeEnhancementAudioContext = null
      }
      void ctx.close().catch(() => {})
      activeEnhancementAudioCloseTimer = null
    }, 1700)
  } catch {}
}

function EnhancementPickaxe({
  level,
  broken
}: {
  level: number
  broken: boolean
}) {
  const enchanted = level >= 8 && !broken
  const src = enchanted
    ? 'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/enhancement-lab/enchanted-diamond-pickaxe.webp?v=20260926b'
    : 'https://raw.githubusercontent.com/gkzero0-cmyk/justserver3/main/public/enhancement-lab/diamond-pickaxe.png?v=20260926b'

  return (
    <span className="enhancement-pickaxe-art">
      <img
        className="enhancement-pickaxe-image"
        src={src}
        alt={
          enchanted
            ? '인챈트된 다이아몬드 곡괭이'
            : '다이아몬드 곡괭이'
        }
        draggable={false}
        width={160}
        height={160}
      />
      {enchanted && (
        <img
          className="enhancement-pickaxe-glint-image"
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          width={160}
          height={160}
        />
      )}
    </span>
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
  const [soundVolume, setSoundVolume] = useState(0.75)
  const [outcome, setOutcome] = useState<EnhancementOutcome | null>(null)
  const [message, setMessage] = useState(
    '강화 버튼을 눌러 +15에 도전해보세요.'
  )
  const [newBestLevel, setNewBestLevel] = useState<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const bestTimerRef = useRef<number | null>(null)

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

  const runSuccessRate = useMemo(() => {
    if (!stats.run.attempts) return 0
    return Math.round((stats.run.successes / stats.run.attempts) * 100)
  }, [stats.run.attempts, stats.run.successes])

  useEffect(() => {
    const saved = normalizeStats(
      readWikiStateValue('enhancementLab', DEFAULT_STATS)
    )
    setStats(saved)
    setBroken(saved.broken)

    const savedVolumeValue = window.localStorage.getItem(
      'justserver3:enhancement-volume'
    )
    if (savedVolumeValue !== null) {
      const savedVolume = Number(savedVolumeValue)
      if (Number.isFinite(savedVolume)) {
        setSoundVolume(Math.max(0, Math.min(1, savedVolume)))
      }
    }

    const savedSoundOn = window.localStorage.getItem(
      'justserver3:enhancement-sound-on'
    )
    if (savedSoundOn === 'false') setSoundOn(false)

    setReady(true)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (bestTimerRef.current) window.clearTimeout(bestTimerRef.current)
      if (
        activeEnhancementAudioContext &&
        activeEnhancementAudioContext.state !== 'closed'
      ) {
        void activeEnhancementAudioContext.close().catch(() => {})
        activeEnhancementAudioContext = null
      }
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(
      'justserver3:enhancement-volume',
      String(soundVolume)
    )
    window.localStorage.setItem(
      'justserver3:enhancement-sound-on',
      String(soundOn)
    )
  }, [ready, soundOn, soundVolume])

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
    setMessage('강화 중… 장비를 담금질하고 있습니다.')
    if (soundOn && soundVolume > 0) playTone('charge', from, soundVolume)
    vibrate(18)

    track('wiki_enhancement_attempt', {
      from_level: String(from),
      risk: dangerLabel(from).tone
    })

    timerRef.current = window.setTimeout(() => {
      const historyEntry: EnhancementLogEntry = {
        id: stats.attempts + 1,
        outcome: nextOutcome,
        from,
        to
      }

      const reachedLevel = nextOutcome === 'destroy' ? from : to
      const isNewBest = reachedLevel > stats.best

      const next: EnhancementStats = {
        ...stats,
        attempts: stats.attempts + 1,
        successes:
          stats.successes +
          (nextOutcome === 'success' || nextOutcome === 'max' ? 1 : 0),
        failures: stats.failures + (nextOutcome === 'fail' ? 1 : 0),
        downgrades: stats.downgrades + (nextOutcome === 'down' ? 1 : 0),
        destroyed: stats.destroyed + (nextOutcome === 'destroy' ? 1 : 0),
        best: Math.max(stats.best, reachedLevel),
        maxWins: stats.maxWins + (nextOutcome === 'max' ? 1 : 0),
        level: nextOutcome === 'destroy' ? from : to,
        broken: nextOutcome === 'destroy',
        history: [historyEntry, ...stats.history].slice(0, 8),
        run: {
          attempts: stats.run.attempts + 1,
          successes:
            stats.run.successes +
            (nextOutcome === 'success' || nextOutcome === 'max' ? 1 : 0),
          failures: stats.run.failures + (nextOutcome === 'fail' ? 1 : 0),
          downgrades:
            stats.run.downgrades + (nextOutcome === 'down' ? 1 : 0),
          destroyed:
            stats.run.destroyed + (nextOutcome === 'destroy' ? 1 : 0),
          best: Math.max(
            stats.run.best,
            nextOutcome === 'destroy' ? from : to
          )
        }
      }

      persist(next)
      setOutcome(nextOutcome)
      setMessage(resultMessage(nextOutcome, from, to))
      setAnimating(false)

      if (isNewBest) {
        setNewBestLevel(reachedLevel)
        if (bestTimerRef.current) window.clearTimeout(bestTimerRef.current)
        bestTimerRef.current = window.setTimeout(() => {
          setNewBestLevel(null)
          bestTimerRef.current = null
        }, 1650)
      }

      if (nextOutcome === 'destroy') {
        setBroken(true)
        vibrate([80, 35, 140])
      } else if (nextOutcome === 'down') {
        vibrate([45, 25, 45])
      } else if (nextOutcome === 'success' || nextOutcome === 'max') {
        vibrate(nextOutcome === 'max' ? [25, 20, 25, 20, 70] : 35)
      }

      if (soundOn && soundVolume > 0) {
        playTone(nextOutcome, from, soundVolume)
      }

      track('wiki_enhancement_result', {
        result: nextOutcome,
        from_level: String(from),
        to_level: String(to)
      })
    }, attemptDelay(from))
  }

  const replaceBrokenPickaxe = () => {
    const next = {
      ...stats,
      level: 0,
      broken: false,
      run: {
        attempts: 0,
        successes: 0,
        failures: 0,
        downgrades: 0,
        destroyed: 0,
        best: 0
      }
    }
    persist(next)
    setBroken(false)
    setOutcome(null)
    setNewBestLevel(null)
    setMessage(
      '새 다이아몬드 곡괭이를 지급했습니다. 다시 도전해보세요.'
    )
    track('wiki_enhancement_replace')
  }

  const startNewRun = () => {
    const next = {
      ...stats,
      level: 0,
      broken: false,
      run: {
        attempts: 0,
        successes: 0,
        failures: 0,
        downgrades: 0,
        destroyed: 0,
        best: 0
      }
    }
    persist(next)
    setBroken(false)
    setOutcome(null)
    setNewBestLevel(null)
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
          <p>미니게임 · 장비강화</p>
          <h2 id="enhancement-lab-title">강화 체험소</h2>
          <span>
            위키를 보다가 잠깐 즐길 수 있는 장비강화 체험입니다. +15까지 올려보세요.
          </span>
        </div>
        <div className="enhancement-head-actions">
          <span className="enhancement-sim-badge">체험용 시뮬레이션</span>
          <div className="enhancement-sound-controls">
            <button
              type="button"
              aria-pressed={soundOn}
              onClick={() => setSoundOn((value) => !value)}
            >
              {soundOn ? '효과음 켬' : '효과음 끔'}
            </button>
            <label className="enhancement-volume-control">
              <span aria-hidden="true">{soundVolume === 0 || !soundOn ? '🔇' : '🔊'}</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(soundVolume * 100)}
                aria-label="강화 효과음 볼륨"
                aria-valuetext={Math.round(soundVolume * 100) + '%'}
                onChange={(event) => {
                  const nextVolume = Number(event.currentTarget.value) / 100
                  setSoundVolume(nextVolume)
                  if (nextVolume > 0 && !soundOn) setSoundOn(true)
                }}
              />
              <b>{Math.round(soundVolume * 100)}%</b>
            </label>
            <button
              type="button"
              className="enhancement-sound-test"
              onClick={() => {
                if (!soundOn) setSoundOn(true)
                if (soundVolume > 0) {
                  playTone('success', Math.max(5, stats.level), soundVolume)
                }
              }}
            >
              소리 확인
            </button>
          </div>
        </div>
      </header>

      <div className="enhancement-main-grid">
        <div
          className="enhancement-forge"
          data-tier={glowTier}
          data-risk={danger.tone}
          data-final-attempt={stats.level === 14 ? 'true' : 'false'}
          data-state={
            broken
              ? 'destroy'
              : animating
                ? 'charging'
                : outcome || 'idle'
          }
        >
          <div className="enhancement-forge-grid" aria-hidden="true" />

          {newBestLevel !== null && (
            <div className="enhancement-new-best" role="status">
              <small>새 최고 기록</small>
              <strong>+{newBestLevel}</strong>
            </div>
          )}

          <div className="enhancement-level-row">
            <span className="enhancement-level-label">강화 단계</span>
            <strong>+{stats.level}</strong>
            <span className="enhancement-item-name">다이아몬드 곡괭이</span>
            {(broken || stats.level >= 5) && (
              <span className="enhancement-stage-tag" data-tier={broken ? 'destroy' : glowTier}>
                {enhancementStageLabel(stats.level, broken)}
              </span>
            )}
          </div>

          <div className="enhancement-mobile-odds" aria-label="현재 강화 확률">
            <span><small>성공</small><strong>{successRateLabel}</strong></span>
            <span><small>실패</small><strong>{rule.fail}%</strong></span>
            <span><small>하락</small><strong>{rule.down}%</strong></span>
            <span><small>파괴</small><strong>{rule.destroy}%</strong></span>
          </div>

          <div className="enhancement-item-stage">
            <div
              className="enhancement-slot-shell"
              data-enchanted={stats.level >= 8 && !broken ? 'true' : 'false'}
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
                    {!broken && stats.level >= 5 && (
                      <span className="enhancement-pickaxe-runes" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                    <div className="enhancement-particles" aria-hidden="true">
                      {Array.from({ length: 12 }, (_, index) => (
                        <i
                          key={index}
                          style={{ '--i': index } as CSSProperties}
                        />
                      ))}
                    </div>
                    {broken && (
                      <>
                        <div className="enhancement-break-pieces" aria-hidden="true">
                          {Array.from({ length: 8 }, (_, index) => (
                            <i
                              key={'piece-' + index}
                              data-part={index < 5 ? 'diamond' : 'handle'}
                              style={{ '--i': index } as CSSProperties}
                            />
                          ))}
                        </div>
                        <div className="enhancement-shards" aria-hidden="true">
                          {Array.from({ length: 12 }, (_, index) => (
                            <i
                              key={index}
                              style={{ '--i': index } as CSSProperties}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>


            <div className="enhancement-item-tooltip">
              <strong>다이아몬드 곡괭이</strong>
              <span>
                {broken
                  ? '파괴 상태 · 새 곡괭이를 받아 다시 도전합니다.'
                  : stats.level >= 15
                    ? '최대강화 · +15 달성'
                    : enhancementStageLabel(stats.level) +
                      ' 단계 · 다음 강화 성공 확률 ' +
                      rule.success +
                      '%'}
              </span>
            </div>
          </div>

          <div
            className="enhancement-result"
            data-outcome={animating ? 'charging' : outcome || 'idle'}
            aria-live="polite"
          >
            <span aria-hidden="true">
              {animating
                ? '⚒'
                : outcome === 'max'
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

          <div
            className="enhancement-action-odds"
            data-risk={danger.tone}
            aria-label="이번 강화 핵심 확률"
          >
            {stats.level >= 15 ? (
              <strong>+15 최대 강화 달성</strong>
            ) : (
              <>
                <span><small>성공</small><b>{rule.success}%</b></span>
                <i aria-hidden="true">·</i>
                <span><small>실패</small><b>{rule.fail}%</b></span>
                {rule.down > 0 && (
                  <>
                    <i aria-hidden="true">·</i>
                    <span><small>하락</small><b>{rule.down}%</b></span>
                  </>
                )}
                {rule.destroy > 0 && (
                  <>
                    <i aria-hidden="true">·</i>
                    <span className="is-danger"><small>파괴</small><b>{rule.destroy}%</b></span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="enhancement-action-zone">
            <button
              type="button"
              className={
                'enhancement-primary' +
                (broken ? ' is-replace' : '') +
                (stats.level >= 15 ? ' is-max' : '')
              }
              data-risk={danger.tone}
              disabled={!ready || animating}
              onClick={
                broken
                  ? replaceBrokenPickaxe
                  : stats.level >= 15
                    ? startNewRun
                    : enhance
              }
            >
              {broken
                ? '새 곡괭이 받기'
                : stats.level >= 15
                  ? '새 강화 도전 시작'
                  : animating
                    ? stats.level >= 12
                      ? '판정 중…'
                      : '강화 중…'
                    : stats.level === 14
                      ? '최종 강화 도전'
                      : rule.destroy > 0
                        ? '파괴 가능 · 강화하기'
                        : stats.level >= 5
                          ? '주의 · 강화하기'
                          : '강화하기'}
              <span>
                {broken
                  ? '0강부터 재도전'
                  : stats.level >= 15
                    ? '+15 달성 완료'
                    : '+' + stats.level + ' → +' + (stats.level + 1) +
                      (stats.level === 14 ? ' · +15 도전' : '')}
              </span>
            </button>
          </div>

          <div className="enhancement-run-result-slot" aria-live="polite">
            {(broken || stats.level >= 15) ? (
              <section
                className="enhancement-run-result"
                data-outcome={broken ? 'destroy' : 'max'}
                aria-label="이번 강화 도전 결과"
              >
                <div>
                  <small>{broken ? '도전 종료' : '도전 완료'}</small>
                  <strong>
                    {broken
                      ? '곡괭이가 파괴되었습니다'
                      : '+15 강화에 성공했습니다'}
                  </strong>
                </div>
                <div className="enhancement-run-result-stats">
                  <span><small>총 시도</small><b>{stats.run.attempts}</b></span>
                  <span><small>최고 강화</small><b>+{stats.run.best}</b></span>
                  <span><small>성공</small><b>{stats.run.successes}</b></span>
                  <span><small>하락</small><b>{stats.run.downgrades}</b></span>
                </div>
              </section>
            ) : (
              <div className="enhancement-run-result-placeholder" aria-hidden="true">
                <span>이번 도전 결과가 여기에 표시됩니다.</span>
              </div>
            )}
          </div>

          <div className="enhancement-recent-log">
            <div className="enhancement-log-head">
              <strong>최근 강화 기록</strong>
              <span>최근 {Math.min(stats.history.length, 5)}회</span>
            </div>
            <div className="enhancement-log-list">
              {Array.from({ length: 5 }, (_, index) => {
                const entry = stats.history[index]
                return entry ? (
                  <span
                    key={entry.id}
                    data-outcome={entry.outcome}
                    title={resultMessage(entry.outcome, entry.from, entry.to)}
                  >
                    <b>{outcomeLabel(entry.outcome)}</b>
                    <small>
                      {entry.outcome === 'destroy'
                        ? '+' + entry.from + ' → 파괴'
                        : entry.outcome === 'fail'
                          ? '+' + entry.from + ' 유지'
                          : '+' + entry.from + ' → +' + entry.to}
                    </small>
                  </span>
                ) : (
                  <span
                    key={'empty-' + index}
                    className="is-empty"
                    aria-hidden="true"
                  >
                    <b>대기</b>
                    <small>—</small>
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="enhancement-side">
          <section className="enhancement-probability">
            <div className="enhancement-panel-title">
              <div>
                <small>강화 확률</small>
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
                <strong>최대 +15</strong>
                <span>최고 단계에 도달했습니다.</span>
              </div>
            )}

            {stats.level < 15 && rule.destroy > 0 && (
              <div className="enhancement-risk-warning" role="note">
                <strong>파괴 위험 {rule.destroy}%</strong>
                <span>실패 판정에 따라 장비가 파괴될 수 있습니다.</span>
              </div>
            )}

            <p>
              이 확률은 <strong>위키 미니게임 전용</strong>입니다. 실제 서버의
              장비강화 수치나 규칙을 의미하지 않습니다.
            </p>
          </section>

          <section className="enhancement-run">
            <div className="enhancement-panel-title">
              <div>
                <small>이번 도전</small>
                <strong>현재 곡괭이 기록</strong>
              </div>
              <span data-tone={danger.tone}>{danger.label}</span>
            </div>
            <div className="enhancement-run-highlight">
              <span>
                <small>현재 강화</small>
                <strong>+{stats.level}</strong>
              </span>
              <span>
                <small>이번 최고</small>
                <strong>+{stats.run.best}</strong>
              </span>
              <span>
                <small>성공률</small>
                <strong>{runSuccessRate}%</strong>
              </span>
            </div>
            <div className="enhancement-run-strip">
              <span><small>시도</small><strong>{stats.run.attempts}</strong></span>
              <span><small>성공</small><strong>{stats.run.successes}</strong></span>
              <span><small>하락</small><strong>{stats.run.downgrades}</strong></span>
              <span><small>파괴</small><strong>{stats.run.destroyed}</strong></span>
            </div>
          </section>

          <details className="enhancement-records">
            <summary className="enhancement-panel-title">
              <div>
                <small>전체 기록</small>
                <strong>누적 강화 기록</strong>
              </div>
              <b>최고 +{stats.best}</b>
            </summary>

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
          </details>

          <details className="enhancement-links">
            <summary className="enhancement-panel-title">
              <div>
                <small>관련 문서</small>
                <strong>가이드 펼쳐보기</strong>
              </div>
              <b>+</b>
            </summary>
            <div className="enhancement-guide-recommendation" aria-live="polite">
              <small>현재 단계 추천</small>
              <strong>
                {broken
                  ? '장비수리 문서를 확인해보세요.'
                  : stats.level >= 8
                    ? '고강화 구간 · 장비강화 문서를 참고할 수 있어요.'
                    : '강화 규칙이 궁금할 때 관련 문서를 확인하세요.'}
              </strong>
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
          </details>
        </aside>
      </div>
    </section>
  )
}
