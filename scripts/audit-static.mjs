import { appendFile, readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, relative } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))
const workflowsDir = join(root, '.github', 'workflows')
const workflowNames = (await readdir(workflowsDir)).filter((name) => /\.ya?ml$/i.test(name))
const workflows = Object.fromEntries(
  await Promise.all(
    workflowNames.map(async (name) => [
      name,
      await readFile(join(workflowsDir, name), 'utf8')
    ])
  )
)
const deployPages = workflows['deploy-pages.yml'] || ''
const buildWorkflow = workflows['build.yml'] || ''

const blocking = []
const notes = []
const baseline = {
  missingDimensions: 0,
  missingLoading: 3
}

const actionMajorMinimum = {
  'actions/checkout': 7,
  'actions/setup-node': 7,
  'actions/upload-artifact': 7,
  'actions/upload-pages-artifact': 5,
  'actions/deploy-pages': 5
}

if (pkg.engines?.node !== '24.x') {
  blocking.push(`package.json engines.node is ${pkg.engines?.node || '(missing)'}, expected 24.x`)
}
if (lock.packages?.['']?.engines?.node !== '24.x') {
  blocking.push(`package-lock root engines.node is ${lock.packages?.['']?.engines?.node || '(missing)'}, expected 24.x`)
}
if (!/node-version:\s*24\b/.test(deployPages)) {
  blocking.push('deploy-pages.yml is not using Node 24')
}
if (!/run:\s*npm ci\b/.test(deployPages)) {
  blocking.push('deploy-pages.yml is not using npm ci')
}
if (!/node-version:\s*24\b/.test(buildWorkflow)) {
  blocking.push('build.yml is not using Node 24')
}

for (const [name, source] of Object.entries(workflows)) {
  const versions = [...source.matchAll(/node-version:\s*['"]?(\d+)/g)].map((match) => match[1])
  for (const version of versions) {
    if (version !== '24') {
      blocking.push(`${name} uses Node ${version}, expected Node 24`)
    }
  }

  for (const [action, minimum] of Object.entries(actionMajorMinimum)) {
    const pattern = new RegExp(`${action.replace('/', '\\/')}@v(\\d+)`, 'g')
    for (const match of source.matchAll(pattern)) {
      const major = Number(match[1])
      if (major < minimum) {
        blocking.push(`${name} uses ${action}@v${major}, expected v${minimum}+`)
      }
    }
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (/\.(?:tsx|ts|jsx|js)$/.test(entry.name)) files.push(full)
  }
  return files
}

const sourceFiles = [
  ...(await walk(join(root, 'app'))),
  ...(await walk(join(root, 'components')))
]

const trackedFiles = execFileSync('git', ['ls-files'], {
  cwd: root,
  encoding: 'utf8'
})
  .split(/\r?\n/)
  .filter(Boolean)

const sensitiveTracked = trackedFiles.filter((file) =>
  /(^|\/)(?:\.env(?:\.[^/]+)?|id_rsa|id_ed25519|credentials(?:\.[^/]+)?|secrets?(?:\.[^/]+)?)(?:$|\/)/i.test(file)
).filter((file) => !/(^|\/)\.env\.example$/i.test(file))

for (const file of sensitiveTracked) {
  blocking.push(`sensitive-looking tracked file: ${file}`)
}

let imgCount = 0
let missingDimensions = 0
let missingLoading = 0
let unsafeMarkup = 0
let brokenInternalLinks = 0
const examples = []
const internalLinkExamples = []

const routeSource = await readFile(join(root, 'lib/wiki-routes.ts'), 'utf8')
const knownGuideSlugs = new Set(
  [...routeSource.matchAll(/'([a-z0-9-]+)'\s*\]\s*,?$/gm)].map((match) => match[1])
)
const knownPageIds = new Set(
  [...routeSource.matchAll(/\['([0-9a-f]{32})',/gi)].map((match) => match[1].toLowerCase())
)
const loadingExamples = []

for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8')
  const tags = source.match(/<img\b[\s\S]*?>/g) || []
  for (const tag of tags) {
    imgCount += 1
    const hasWidth = /\bwidth\s*=/.test(tag)
    const hasHeight = /\bheight\s*=/.test(tag)
    const hasLoading = /\bloading\s*=/.test(tag)

    if (!hasWidth || !hasHeight) {
      missingDimensions += 1
      if (examples.length < 12) {
        examples.push(`${relative(root, file)}: img missing explicit width/height`)
      }
    }
    if (!hasLoading) {
      missingLoading += 1
      if (loadingExamples.length < 12) {
        loadingExamples.push(`${relative(root, file)}: img without explicit loading attribute`)
      }
    }
  }

  const unsafe = source.match(/(?:href|src)\s*=\s*["'{]?(?:javascript|vbscript):/gi) || []
  unsafeMarkup += unsafe.length
  if (unsafe.length) {
    blocking.push(`${relative(root, file)} contains unsafe URL-like markup`)
  }

  const linkMatches = [
    ...source.matchAll(/(?:href|to)\s*=\s*["'](\/[^"'?#]*)/g),
    ...source.matchAll(/Link\s+href=["'](\/[^"'?#]*)/g)
  ]
  for (const match of linkMatches) {
    const target = match[1]
    const guide = target.match(/^\/guide\/([a-z0-9-]+)\/?$/i)
    const page = target.match(/^\/page\/([0-9a-f-]{32,36})\/?$/i)

    if (guide && !knownGuideSlugs.has(guide[1].toLowerCase())) {
      brokenInternalLinks += 1
      if (internalLinkExamples.length < 12) {
        internalLinkExamples.push(`${relative(root, file)} -> ${target}`)
      }
    }

    if (page) {
      const normalized = page[1].replaceAll('-', '').toLowerCase()
      if (!knownPageIds.has(normalized)) {
        brokenInternalLinks += 1
        if (internalLinkExamples.length < 12) {
          internalLinkExamples.push(`${relative(root, file)} -> ${target}`)
        }
      }
    }
  }
}

notes.push(`Source files scanned: ${sourceFiles.length}`)
notes.push(`TSX/JSX img tags: ${imgCount}`)
notes.push(`Image tags missing explicit dimensions: ${missingDimensions}`)
notes.push(`Image tags without loading attribute: ${missingLoading}`)
notes.push(`Unsafe URL-like markup findings: ${unsafeMarkup}`)
notes.push(`Broken static internal links: ${brokenInternalLinks}`)
notes.push(`Sensitive-looking tracked files: ${sensitiveTracked.length}`)

if (brokenInternalLinks > 0) {
  blocking.push(`found ${brokenInternalLinks} invalid static internal links`)
}

if (missingDimensions > baseline.missingDimensions) {
  blocking.push(
    `image tags missing explicit dimensions increased above baseline ${baseline.missingDimensions}: ${missingDimensions}`
  )
}
if (missingLoading > baseline.missingLoading) {
  blocking.push(
    `image tags without loading attribute increased above baseline ${baseline.missingLoading}: ${missingLoading}`
  )
}

for (const note of notes) console.log(`INFO ${note}`)
for (const example of examples) console.log(`AUDIT ${example}`)
for (const example of loadingExamples) console.log(`AUDIT ${example}`)
for (const example of internalLinkExamples) console.log(`AUDIT broken-link ${example}`)
for (const item of blocking) console.error(`FAIL ${item}`)

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Configuration & markup audit',
      '',
      ...notes.map((note) => `- ${note}`),
      `- Blocking configuration findings: ${blocking.length}`,
      '',
      `Image regression baseline: dimensions <= ${baseline.missingDimensions}, loading omissions <= ${baseline.missingLoading}.`,
      'Existing intentional loading omissions are allowed, but increases fail the build.',
      ''
    ].join('\n')
  )
}

if (blocking.length) process.exitCode = 1
