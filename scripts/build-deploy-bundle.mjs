import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, '.deploy', 'current.json')

const rootFiles = [
  'next-env.d.ts',
  'next.config.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vercel.json'
]

const sourceDirs = ['app', 'components', 'lib', 'tests']
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

const paths = [
  ...rootFiles,
  ...sourceDirs.flatMap(walk),
  ...publicJsonFiles
]
  .filter((file) => fs.existsSync(path.join(root, file)))
  .sort((a, b) => a.localeCompare(b))

const files = paths.map((file) => ({
  file,
  data: fs.readFileSync(path.join(root, file), 'utf8')
}))

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(files))

const bytes = files.reduce((sum, item) => sum + Buffer.byteLength(item.data), 0)
console.log(`Prepared ${files.length} deploy files (${bytes} source bytes).`)
