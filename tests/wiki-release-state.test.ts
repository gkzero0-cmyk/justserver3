import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveDeployableMainSha } from '../lib/wiki-release-state.ts'

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
