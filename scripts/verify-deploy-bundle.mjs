import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const bundlePath = path.join(root, '.deploy', 'current.json')

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

      if (!failed) {
        pass(`${bundle.length} deploy files validated (${sourceBytes} source bytes)`)
      }
    }
  }
}

if (failed) process.exitCode = 1
