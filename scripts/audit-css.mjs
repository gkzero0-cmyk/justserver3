import { readFile } from 'node:fs/promises'
import process from 'node:process'

const files = ['app/globals.css', 'app/wiki-reader.css', 'app/home.css', 'app/status/status.css', 'components/wiki-enhancement-lab.css']
const legacyCoolColors = new Set([
  '#e8edf4',
  '#e4ebf4',
  '#e5ebf3',
  '#dce5ef',
  '#dbe4ee',
  '#cbd5e1',
  '#aeb9c8',
  '#aab6c7',
  '#94a3b8',
  '#8795a9',
  '#7f8da2',
  '#8190a3',
  '#7d8ba0',
  '#718096',
  '#637083',
  '#627083',
  '#5f6d7e'
])

const findings = []
for (const file of files) {
  const source = await readFile(file, 'utf8')
  const lines = source.split(/\r?\n/)

  lines.forEach((line, index) => {
    const fontMatches = [...line.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/gi)]
    for (const match of fontMatches) {
      const size = Number(match[1])
      if (size < 10) {
        findings.push({
          type: 'tiny-font',
          file,
          line: index + 1,
          value: `${size}px`,
          sample: line.trim()
        })
      }
    }

    const colorMatches = [...line.matchAll(/#[0-9a-f]{6}\b/gi)]
    for (const match of colorMatches) {
      const value = match[0].toLowerCase()
      if (legacyCoolColors.has(value)) {
        findings.push({
          type: 'legacy-cool-color',
          file,
          line: index + 1,
          value,
          sample: line.trim()
        })
      }
    }
  })
}

const tinyFonts = findings.filter((item) => item.type === 'tiny-font')
const coolColors = findings.filter((item) => item.type === 'legacy-cool-color')

const baseline = {
  tinyFonts: 0,
  coolColors: 0
}

let regressed = false
if (tinyFonts.length > baseline.tinyFonts) {
  regressed = true
  console.error(
    `FAIL sub-10px font declarations increased from ${baseline.tinyFonts} to ${tinyFonts.length}`
  )
}
if (coolColors.length > baseline.coolColors) {
  regressed = true
  console.error(
    `FAIL legacy cool-color declarations increased from ${baseline.coolColors} to ${coolColors.length}`
  )
}

console.log(
  `CSS audit: ${tinyFonts.length} sub-10px font declarations, ${coolColors.length} legacy cool-color declarations`
)

for (const item of findings.slice(0, 30)) {
  console.log(
    `AUDIT ${item.type} ${item.file}:${item.line} ${item.value} — ${item.sample}`
  )
}

if (findings.length > 30) {
  console.log(`AUDIT … ${findings.length - 30} additional findings omitted from console`)
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises')
  const sample = findings.slice(0, 20)
  const rows = sample.length
    ? sample.map(
        (item) =>
          `| ${item.type} | ${item.file}:${item.line} | ${item.value} |`
      )
    : ['| none | — | — |']

  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## CSS audit',
      '',
      `- Sub-10px font declarations: ${tinyFonts.length}`,
      `- Legacy cool-color declarations: ${coolColors.length}`,
      '',
      `Baseline: <= ${baseline.tinyFonts} sub-10px declarations and <= ${baseline.coolColors} legacy colors.`,
      'Sub-10px text and retired cool-tone colors are not allowed.',
      '',
      '| Finding | Location | Value |',
      '| --- | --- | --- |',
      ...rows,
      ''
    ].join('\n')
  )
}

if (regressed) process.exitCode = 1
