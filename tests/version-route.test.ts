import assert from 'node:assert/strict'
import test from 'node:test'

import { GET } from '../app/api/version/route.ts'

test('version route exposes deployment identity without caching', async () => {
  const previousCommit = process.env.VERCEL_GIT_COMMIT_SHA
  const previousEnvironment = process.env.VERCEL_ENV

  process.env.VERCEL_GIT_COMMIT_SHA = 'test-commit-sha'
  process.env.VERCEL_ENV = 'preview'

  try {
    const response = GET()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')

    const body = await response.json()
    assert.deepEqual(body, {
      commit: 'test-commit-sha',
      environment: 'preview'
    })
  } finally {
    if (previousCommit === undefined) {
      delete process.env.VERCEL_GIT_COMMIT_SHA
    } else {
      process.env.VERCEL_GIT_COMMIT_SHA = previousCommit
    }

    if (previousEnvironment === undefined) {
      delete process.env.VERCEL_ENV
    } else {
      process.env.VERCEL_ENV = previousEnvironment
    }
  }
})

test('version route falls back safely outside Vercel', async () => {
  const previousVercelCommit = process.env.VERCEL_GIT_COMMIT_SHA
  const previousGithubCommit = process.env.GITHUB_SHA
  const previousEnvironment = process.env.VERCEL_ENV

  delete process.env.VERCEL_GIT_COMMIT_SHA
  process.env.GITHUB_SHA = 'github-test-sha'
  delete process.env.VERCEL_ENV

  try {
    const response = GET()
    const body = await response.json()

    assert.equal(body.commit, 'github-test-sha')
    assert.equal(body.environment, 'unknown')
  } finally {
    if (previousVercelCommit === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA
    else process.env.VERCEL_GIT_COMMIT_SHA = previousVercelCommit

    if (previousGithubCommit === undefined) delete process.env.GITHUB_SHA
    else process.env.GITHUB_SHA = previousGithubCommit

    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousEnvironment
  }
})
