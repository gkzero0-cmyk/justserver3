import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_ENHANCEMENT_STATS,
  ENHANCEMENT_RULES,
  enhancementAttemptDelay,
  enhancementDanger,
  enhancementStageLabel,
  normalizeEnhancementStats,
  resolveEnhancementOutcome
} from '../components/wiki-enhancement-rules.ts'

test('enhancement probability rows always total 100 percent', () => {
  assert.equal(ENHANCEMENT_RULES.length, 15)

  for (const [level, rule] of ENHANCEMENT_RULES.entries()) {
    assert.equal(
      rule.success + rule.fail + rule.down + rule.destroy,
      100,
      `+${level} probability row must total 100`
    )
  }
})

test('enhancement outcome boundaries match the configured rule', () => {
  assert.deepEqual(resolveEnhancementOutcome(7, 48.999), {
    outcome: 'success',
    to: 8
  })
  assert.deepEqual(resolveEnhancementOutcome(7, 49), {
    outcome: 'fail',
    to: 7
  })
  assert.deepEqual(resolveEnhancementOutcome(7, 79), {
    outcome: 'down',
    to: 6
  })
  assert.deepEqual(resolveEnhancementOutcome(7, 97), {
    outcome: 'destroy',
    to: 0
  })
  assert.deepEqual(resolveEnhancementOutcome(14, 0), {
    outcome: 'max',
    to: 15
  })
})

test('saved enhancement state is normalized and clamped', () => {
  const normalized = normalizeEnhancementStats({
    level: 99,
    best: -4,
    attempts: -2,
    broken: 1,
    history: [
      { id: 2, outcome: 'success', from: 14, to: 99 },
      { id: 'bad', outcome: 'destroy', from: 3, to: 0 }
    ],
    run: { attempts: 3, successes: 2, failures: 1, best: 22 }
  })

  assert.equal(normalized.level, 15)
  assert.equal(normalized.best, 0)
  assert.equal(normalized.attempts, 0)
  assert.equal(normalized.broken, true)
  assert.equal(normalized.history.length, 1)
  assert.equal(normalized.history[0].to, 15)
  assert.equal(normalized.run.best, 15)

  const empty = normalizeEnhancementStats(null)
  assert.deepEqual(empty, DEFAULT_ENHANCEMENT_STATS)
  assert.notEqual(empty.run, DEFAULT_ENHANCEMENT_STATS.run)
  assert.notEqual(empty.history, DEFAULT_ENHANCEMENT_STATS.history)
})

test('enhancement labels and timing preserve risk progression', () => {
  assert.deepEqual(enhancementDanger(0), { label: '안정', tone: 'safe' })
  assert.deepEqual(enhancementDanger(7), { label: '주의', tone: 'caution' })
  assert.deepEqual(enhancementDanger(10), { label: '위험', tone: 'danger' })
  assert.deepEqual(enhancementDanger(11), { label: '극한', tone: 'extreme' })

  assert.equal(enhancementStageLabel(0), '기본')
  assert.equal(enhancementStageLabel(8), '고강화')
  assert.equal(enhancementStageLabel(15), '최대강화')
  assert.equal(enhancementStageLabel(11, true), '파괴')

  assert.equal(enhancementAttemptDelay(0), 650)
  assert.equal(enhancementAttemptDelay(5), 800)
  assert.equal(enhancementAttemptDelay(8), 980)
  assert.equal(enhancementAttemptDelay(12), 1200)
  assert.equal(enhancementAttemptDelay(14), 1450)
})
