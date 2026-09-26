import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const bundlePath = path.join(root, '.deploy', 'current.json')

const rootFiles = [
  'next-env.d.ts',
  'next.config.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vercel.json'
]

const sourceDirs = ['app', 'components', 'data', 'lib', 'tests']
const publicJsonFiles = [
  'public/notion-assets/display-manifest.json',
  'public/notion-assets/index.json',
  'public/notion-assets/manifest.json',
  'public/notion-assets/search-index.json'
]

const allowedExtensions = new Set(['.ts', '.tsx', '.css', '.json'])

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir)
  if (!fs.existsSync(absoluteDir)) return []

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDir.replaceAll('\\', '/'), entry.name)
    if (entry.isDirectory()) return walk(relativePath)
    return allowedExtensions.has(path.extname(entry.name)) ? [relativePath] : []
  })
}

function expectedSourcePaths() {
  return [
    ...rootFiles,
    ...sourceDirs.flatMap(walk),
    ...publicJsonFiles
  ]
    .filter((file) => fs.existsSync(path.join(root, file)))
    .sort((a, b) => a.localeCompare(b))
}

function sourceDigest(entries) {
  const hash = createHash('sha256')
  for (const entry of entries) {
    hash.update(entry.file)
    hash.update('\0')
    hash.update(entry.data)
    hash.update('\0')
  }
  return hash.digest('hex')
}

let failed = false
function fail(message) {
  failed = true
  console.error(`FAIL ${message}`)
}
function pass(message) {
  console.log(`PASS ${message}`)
}

if (!fs.existsSync(bundlePath)) {
  fail('.deploy/current.json is missing')
} else {
  let bundle
  try {
    bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))
  } catch (error) {
    fail(`deploy bundle is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (bundle) {
    if (!Array.isArray(bundle)) {
      fail('deploy bundle root must be an array')
    } else {
      const paths = new Set()
      let sourceBytes = 0

      for (const entry of bundle) {
        if (!entry || typeof entry.file !== 'string' || typeof entry.data !== 'string') {
          fail('deploy bundle contains an invalid entry')
          continue
        }

        if (paths.has(entry.file)) fail(`duplicate deploy bundle path: ${entry.file}`)
        paths.add(entry.file)
        sourceBytes += Buffer.byteLength(entry.data)

        if (
          /(^|\/)(?:\.env(?:\.|$)|id_rsa|id_ed25519|credentials|secrets?)(?:\/|$)/i.test(entry.file)
        ) {
          fail(`sensitive-looking file included in deploy bundle: ${entry.file}`)
        }
      }

      const required = [
        'package.json',
        'package-lock.json',
        'next.config.ts',
        'vercel.json',
        'app/page.tsx',
        'app/layout.tsx',
        'app/api/version/route.ts',
        'lib/wiki-routes.ts',
        'public/notion-assets/index.json',
        'public/notion-assets/search-index.json'
      ]

      for (const file of required) {
        if (!paths.has(file)) fail(`required deploy file missing: ${file}`)
      }

      const packageEntry = bundle.find((entry) => entry.file === 'package.json')
      if (packageEntry) {
        try {
          const pkg = JSON.parse(packageEntry.data)
          if (pkg.engines?.node !== '24.x') {
            fail(`deploy bundle package engine is ${pkg.engines?.node || '(missing)'}, expected 24.x`)
          }
        } catch {
          fail('package.json inside deploy bundle is invalid JSON')
        }
      }

      const expectedPaths = expectedSourcePaths()
      const bundlePaths = [...paths].sort((a, b) => a.localeCompare(b))

      const missingFromBundle = expectedPaths.filter((file) => !paths.has(file))
      const staleBundleFiles = bundlePaths.filter((file) => !expectedPaths.includes(file))

      for (const file of missingFromBundle) {
        fail(`current source file missing from deploy bundle: ${file}`)
      }
      for (const file of staleBundleFiles) {
        fail(`stale file remains in deploy bundle: ${file}`)
      }

      const bundleByPath = new Map(bundle.map((entry) => [entry.file, entry.data]))
      const expectedEntries = expectedPaths.map((file) => ({
        file,
        data: fs.readFileSync(path.join(root, file), 'utf8')
      }))

      for (const entry of expectedEntries) {
        const bundled = bundleByPath.get(entry.file)
        if (bundled !== entry.data) {
          fail(`deploy bundle content is stale: ${entry.file}`)
        }
      }

      const digest = sourceDigest(expectedEntries)
      console.log(`INFO deploy bundle source SHA-256: ${digest}`)

      if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          [
            '## Deploy bundle fingerprint',
            '',
            `- Files: ${expectedEntries.length}`,
            `- Source bytes: ${sourceBytes}`,
            `- SHA-256: \`${digest}\``,
            `- Exact source match: ${failed ? 'no' : 'yes'}`,
            ''
          ].join('\n')
        )
      }

      if (!failed) {
        pass(`${bundle.length} deploy files exactly match current source (${sourceBytes} source bytes)`)
      }
    }
  }
}

if (failed) process.exitCode = 1
