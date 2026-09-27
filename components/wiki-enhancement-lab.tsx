'use client'

import Link from 'next/link'
import './wiki-enhancement-lab.css'
import { track } from '@vercel/analytics'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import {
  readWikiStateValue,
  writeWikiStateValue
} from '@/lib/wiki-client-state'
import type { WikiContentStatus } from '@/lib/wiki-content-status'
import { withBasePath } from '@/lib/url-utils'
import { wikiGuidePath } from '@/lib/wiki-routes'
import {
  closeEnhancementAudio,
  playEnhancementTone
} from '@/components/wiki-enhancement-audio'
import {
  DEFAULT_ENHANCEMENT_STATS,
  ENHANCEMENT_RULES,
  enhancementAttemptDelay,
  enhancementDanger,
  enhancementOutcomeLabel,
  enhancementResultMessage,
  enhancementStageLabel,
  normalizeEnhancementStats,
  resolveEnhancementOutcome,
  type EnhancementLogEntry,
  type EnhancementOutcome,
  type EnhancementStats
} from '@/components/wiki-enhancement-rules'

type EnhancementPage = {
  pageId: string
  title: string
  status?: WikiContentStatus
}

function randomPercent() {
  const values = new Uint32Array(1)
  window.crypto.getRandomValues(values)
  return (values[0] / 0xffffffff) * 100
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
        loading="eager"
        decoding="async"
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
          loading="eager"
          decoding="async"
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
  const [stats, setStats] = useState<EnhancementStats>(DEFAULT_ENHANCEMENT_STATS)
  const [ready, setReady] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [broken, setBroken] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [soundVolume, setSoundVolume] = useState(1)
  const [outcome, setOutcome] = useState<EnhancementOutcome | null>(null)
  const [message, setMessage] = useState(
    '강화 버튼을 눌러 +15에 도전해보세요.'
  )
  const [newBestLevel, setNewBestLevel] = useState<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const bestTimerRef = useRef<number | null>(null)

  const rule = ENHANCEMENT_RULES[Math.min(stats.level, 14)]
  const danger = enhancementDanger(stats.level)
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
    const saved = normalizeEnhancementStats(
      readWikiStateValue('enhancementLab', DEFAULT_ENHANCEMENT_STATS)
    )
    setStats(saved)
    setBroken(saved.broken)

    const savedVolumeValue = window.localStorage.getItem(
      'justserver3:enhancement-volume'
    )
    const volumePresetVersion = window.localStorage.getItem(
      'justserver3:enhancement-volume-version'
    )
    if (savedVolumeValue !== null) {
      const savedVolume = Number(savedVolumeValue)
      if (Number.isFinite(savedVolume)) {
        const normalized = Math.max(0, Math.min(1, savedVolume))
        const migrated =
          volumePresetVersion !== '3' &&
          (Math.abs(normalized - 0.75) < 0.001 ||
            Math.abs(normalized - 0.9) < 0.001)
            ? 1
            : normalized
        setSoundVolume(migrated)
      }
    }
    window.localStorage.setItem('justserver3:enhancement-volume-version', '3')

    const savedSoundOn = window.localStorage.getItem(
      'justserver3:enhancement-sound-on'
    )
    if (savedSoundOn === 'false') setSoundOn(false)

    setReady(true)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (bestTimerRef.current) window.clearTimeout(bestTimerRef.current)
      closeEnhancementAudio()
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
    const roll = randomPercent()
    const { outcome: nextOutcome, to } = resolveEnhancementOutcome(from, roll)

    setAnimating(true)
    setOutcome(null)
    setMessage('강화 중… 장비를 담금질하고 있습니다.')
    if (soundOn && soundVolume > 0) playEnhancementTone('charge', from, soundVolume)
    vibrate(18)

    track('wiki_enhancement_attempt', {
      from_level: String(from),
      risk: enhancementDanger(from).tone
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
      setMessage(enhancementResultMessage(nextOutcome, from, to))
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
        playEnhancementTone(nextOutcome, from, soundVolume)
      }

      track('wiki_enhancement_result', {
        result: nextOutcome,
        from_level: String(from),
        to_level: String(to)
      })
    }, enhancementAttemptDelay(from))
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
              <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
              {soundOn ? '효과음' : '음소거'}
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
                  playEnhancementTone('success', Math.max(5, stats.level), soundVolume)
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
              <div className="enhancement-forge-impact" aria-hidden="true">
                <span className="enhancement-forge-hammer" />
                <span className="enhancement-forge-impact-ring" />
                <span className="enhancement-forge-impact-core" />
                <span className="enhancement-forge-sparks">
                  {Array.from({ length: 16 }, (_, index) => (
                    <i
                      key={'forge-spark-' + index}
                      style={{ '--i': index } as CSSProperties}
                    />
                  ))}
                </span>
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
                    title={enhancementResultMessage(entry.outcome, entry.from, entry.to)}
                  >
                    <b>{enhancementOutcomeLabel(entry.outcome)}</b>
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

            <div
              className="enhancement-risk-warning"
              data-visible={
                stats.level < 15 && rule.destroy > 0 ? 'true' : 'false'
              }
              role={
                stats.level < 15 && rule.destroy > 0 ? 'note' : undefined
              }
              aria-hidden={
                stats.level < 15 && rule.destroy > 0 ? undefined : true
              }
            >
              <strong>파괴 위험 {stats.level < 15 ? rule.destroy : 0}%</strong>
              <span>실패 판정에 따라 장비가 파괴될 수 있습니다.</span>
            </div>

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
                  href={withBasePath(wikiGuidePath(enhancementPage))}
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
                  href={withBasePath(wikiGuidePath(repairPage))}
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
                  href={withBasePath(wikiGuidePath(faqPage))}
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
