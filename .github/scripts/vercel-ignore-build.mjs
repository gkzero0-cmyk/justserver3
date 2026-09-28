import { execFileSync } from 'node:child_process';

function changedFiles() {
  try {
    const parent = execFileSync('git', ['rev-parse', 'HEAD^'], { encoding: 'utf8' }).trim();
    if (!parent) return [];
    return execFileSync('git', ['diff', '--name-only', parent, 'HEAD'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const message = (() => {
  try { return execFileSync('git', ['log', '-1', '--pretty=%B'], { encoding: 'utf8' }); }
  catch { return ''; }
})();

if (/Refresh deploy bundle \[skip ci\]|\[skip vercel\]/i.test(message)) {
  console.log('Skipping Vercel build because the commit explicitly opts out.');
  process.exit(0);
}

const files = changedFiles();
const nonRuntime = files.length > 0 && files.every(file =>
  file.startsWith('.github/') ||
  file.startsWith('tests/') ||
  file.startsWith('docs/') ||
  /^(?:README|CHANGELOG|CONTRIBUTING)(?:\.[^/]*)?$/i.test(file) ||
  /\.md$/i.test(file)
);

if (nonRuntime) {
  console.log('Skipping Vercel build: only CI, tests, docs, or markdown changed.');
  process.exit(0);
}

console.log('Runtime-affecting changes detected; Vercel build should proceed.');
process.exit(1);
