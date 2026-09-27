import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
let failed = false

function fail(message) {
  failed = true
  console.error(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8'
  }).trim()
}

const branch = git(['branch', '--show-current'])
if (branch && branch !== 'main') {
  fail(`release gate must run on main, current branch is ${branch}`)
} else {
  pass('release gate is running on main')
}

const trackedChanges = git(['status', '--porcelain'])
if (trackedChanges) {
  console.error('INFO git status --porcelain:')
  console.error(trackedChanges)
  fail('working tree has uncommitted changes')
} else {
  pass('working tree is clean')
}

const bundlePath = path.join(root, '.deploy', 'current.json')

try {
  execFileSync(process.execPath, ['scripts/build-deploy-bundle.mjs'], {
    cwd: root,
    stdio: 'inherit'
  })
  pass('ephemeral deploy bundle generated for release verification')
} catch {
  fail('deploy bundle generation failed')
}

if (!fs.existsSync(bundlePath)) {
  fail('.deploy/current.json is missing')
}

const head = git(['rev-parse', 'HEAD'])
const message = git(['log', '-1', '--pretty=%B'])
console.log(`INFO repository HEAD: ${head}`)
console.log(`INFO repository HEAD message: ${message.split(/\r?\n/)[0]}`)

try {
  execFileSync(process.execPath, ['scripts/verify-deploy-bundle.mjs'], {
    cwd: root,
    stdio: 'inherit'
  })
  pass('deploy bundle matches the current source tree')
} catch {
  fail('deploy bundle verification failed')
}

const requiredFiles = [
  'vercel.json',
  'public/notion-assets/index.json',
  'public/notion-assets/search-index.json',
  'app/sitemap.ts',
  'app/robots.ts',
  'scripts/verify-production.mjs'
]
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`required release file is missing: ${file}`)
  }
}

if (!failed) {
  pass('repository-side release gate is ready')
  console.log('INFO Vercel rate-limit and live Production checks remain deployment-time checks.')
}

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Release gate',
      '',
      `- Branch: ${branch || '(detached)'}`,
      `- HEAD: \`${head}\``,
      `- Working tree clean: ${trackedChanges ? 'no' : 'yes'}`,
      `- Repository-side gate: ${failed ? 'failed' : 'passed'}`,
      '',
      'Vercel rate-limit, deployment readiness, and Production smoke checks are intentionally evaluated at release time.',
      ''
    ].join('\n')
  )
}

if (failed) process.exitCode = 1
