const baseUrl = (process.env.WIKI_BASE_URL || 'https://justserver3.vercel.app').replace(/\/$/, '')

const checks = [
  {
    path: '/',
    expect: ['그냥서버', '위키']
  },
  {
    path: '/status',
    expect: ['콘텐츠 보강 대기열', '자료 검토 큐', '검색 UX 분석']
  },
  {
    path: '/guide/rules/',
    expect: ['서버규칙']
  },
  {
    path: '/notion-assets/search-index.json',
    expect: ['"pages"', '"sections"']
  }
]

let failed = false

for (const check of checks) {
  const url = baseUrl + check.path
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'justserver3-production-smoke/1.0'
    }
  })
  const text = await response.text()
  const missing = check.expect.filter((value) => !text.includes(value))

  if (!response.ok || missing.length) {
    failed = true
    console.error(
      `FAIL ${check.path} HTTP ${response.status}${missing.length ? ` missing: ${missing.join(', ')}` : ''}`
    )
  } else {
    console.log(`PASS ${check.path} HTTP ${response.status}`)
  }
}

const oldRules =
  baseUrl + '/page/3dad57d6a55c802aa11adaed7c2c98ff'
const legacyResponse = await fetch(oldRules, {
  redirect: 'manual',
  headers: {
    'user-agent': 'justserver3-production-smoke/1.0'
  }
})

const location = legacyResponse.headers.get('location') || ''
if (
  ![301, 302, 307, 308].includes(legacyResponse.status) ||
  !location.includes('/guide/rules')
) {
  failed = true
  console.error(
    `FAIL legacy redirect HTTP ${legacyResponse.status} location=${location || '(none)'}`
  )
} else {
  console.log(
    `PASS legacy redirect HTTP ${legacyResponse.status} -> ${location}`
  )
}

if (failed) process.exitCode = 1
