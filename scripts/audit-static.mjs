import { appendFile, readFile, readdir } from 'node:fs/promises'
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

let imgCount = 0
let missingDimensions = 0
let missingLoading = 0
let unsafeMarkup = 0
const examples = []

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
    if (!hasLoading) missingLoading += 1
  }

  const unsafe = source.match(/(?:href|src)\s*=\s*["'{]?(?:javascript|vbscript):/gi) || []
  unsafeMarkup += unsafe.length
  if (unsafe.length) {
    blocking.push(`${relative(root, file)} contains unsafe URL-like markup`)
  }
}

notes.push(`Source files scanned: ${sourceFiles.length}`)
notes.push(`TSX/JSX img tags: ${imgCount}`)
notes.push(`Image tags missing explicit dimensions: ${missingDimensions}`)
notes.push(`Image tags without loading attribute: ${missingLoading}`)
notes.push(`Unsafe URL-like markup findings: ${unsafeMarkup}`)

for (const note of notes) console.log(`INFO ${note}`)
for (const example of examples) console.log(`AUDIT ${example}`)
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
      'Image findings are informational only; dynamic or above-the-fold images may intentionally omit loading attributes.',
      ''
    ].join('\n')
  )
}

if (blocking.length) process.exitCode = 1
