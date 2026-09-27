import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isVercelSkippedCommit,
  resolveDeployableMainSha,
  resolveDeployableMainShaFromHistory
} from '../lib/wiki-release-state.ts'

test('ignores deploy-bundle-only bot commits when comparing production', () => {
  assert.equal(
    resolveDeployableMainSha({
      sha: 'bundle',
      message: 'Refresh deploy bundle [skip ci]',
      parentSha: 'source'
    }),
    'source'
  )
})

test('ignores explicit skip-vercel commits when comparing production', () => {
  assert.equal(
    resolveDeployableMainSha({
      sha: 'skip',
      message: 'Polish status page [skip vercel]',
      parentSha: 'source'
    }),
    'source'
  )
  assert.equal(isVercelSkippedCommit('Fix docs [SKIP VERCEL]'), true)
})

test('keeps normal source commits as deployment candidates', () => {
  assert.equal(
    resolveDeployableMainSha({
      sha: 'source',
      message: 'Improve wiki',
      parentSha: 'parent'
    }),
    'source'
  )
})

test('finds the latest deployable commit across consecutive skipped commits', () => {
  assert.equal(
    resolveDeployableMainShaFromHistory([
      { sha: 'bundle', message: 'Refresh deploy bundle [skip ci]' },
      { sha: 'skip-two', message: 'Follow-up polish [skip vercel]' },
      { sha: 'skip-one', message: 'Status cleanup [skip vercel]' },
      { sha: 'deployed', message: 'Release wiki' },
      { sha: 'older', message: 'Previous release' }
    ]),
    'deployed'
  )
})
