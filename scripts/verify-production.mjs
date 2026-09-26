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
    path: '/guide/faq/',
    expect: ['빠르게 확인하는 서버 규칙', '11개 확인됨']
  },
  {
    path: '/guide/upgrade/',
    expect: ['장비강화', '강화 체험소', '원본 문서 연동']
  },
  {
    path: '/notion-assets/search-index.json',
    expect: ['"pages"', '"sections"', '재입주할 수 있나요?']
  }
]

const criticalAssets = [
  '/enhancement-lab/diamond-pickaxe.png',
  '/enhancement-lab/enchanted-diamond-pickaxe.webp'
]

const guidePaths = [
  '/guide/story/',
  '/guide/rules/',
  '/guide/patch-notes/',
  '/guide/api/',
  '/guide/newbie-guide/',
  '/guide/mining/',
  '/guide/fishing/',
  '/guide/butchering/',
  '/guide/hunting/',
  '/guide/cooking/',
  '/guide/collection/',
  '/guide/parkour/',
  '/guide/scratch-lottery/',
  '/guide/racecourse/',
  '/guide/casino/',
  '/guide/land/',
  '/guide/debt/',
  '/guide/credit/',
  '/guide/repair/',
  '/guide/upgrade/',
  '/guide/faq/'
]

let failed = false

let searchIndexText = ''

for (const check of checks) {
  const url = baseUrl + check.path
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'justserver3-production-smoke/1.0'
    }
  })
  const text = await response.text()
  if (check.path.includes('search-index.json')) searchIndexText = text
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

for (const path of criticalAssets) {
  const response = await fetch(baseUrl + path, {
    redirect: 'follow',
    headers: {
      'user-agent': 'justserver3-production-smoke/1.0'
    }
  })
  const contentType = response.headers.get('content-type') || ''

  if (!response.ok || !contentType.startsWith('image/')) {
    failed = true
    console.error(
      `FAIL critical asset ${path} HTTP ${response.status} type=${contentType || '(none)'}`
    )
  } else {
    console.log(`PASS critical asset ${path} HTTP ${response.status}`)
  }
}

for (const path of guidePaths) {
  const response = await fetch(baseUrl + path, {
    redirect: 'follow',
    headers: {
      'user-agent': 'justserver3-production-smoke/1.0'
    }
  })

  if (!response.ok) {
    failed = true
    console.error(`FAIL guide route ${path} HTTP ${response.status}`)
  } else {
    console.log(`PASS guide route ${path} HTTP ${response.status}`)
  }
}

if (
  /(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|\\b\\d+)\\.(?:png|jpe?g|webp|gif|svg|avif|bmp)\\b/i.test(
    searchIndexText
  )
) {
  failed = true
  console.error('FAIL search index contains raw image filenames')
} else if (searchIndexText) {
  console.log('PASS search index filename hygiene')
}

const legacyRoutes = [
  ['3dad57d6a55c802a99dcf9704ef883f3', 'story'],
  ['3dad57d6a55c802aa11adaed7c2c98ff', 'rules'],
  ['3e0d57d6a55c80199479ddd73ea6ace4', 'patch-notes'],
  ['3dad57d6a55c80f28689c7bebde648fe', 'api'],
  ['3e0d57d6a55c80e5af78cf3a2ef9ef7e', 'newbie-guide'],
  ['3dad57d6a55c807d8738ee94e33d7b13', 'mining'],
  ['3dad57d6a55c80c0b4adc2aa5676076b', 'fishing'],
  ['3e0d57d6a55c80449496e2d2e8c1d907', 'butchering'],
  ['3e0d57d6a55c80918231cba5c2668bf9', 'hunting'],
  ['3e0d57d6a55c80c5a8afe20753a11db1', 'cooking'],
  ['3e0d57d6a55c80689cfed899c1dc67f6', 'collection'],
  ['3e0d57d6a55c80acb206ece6646c102a', 'parkour'],
  ['3e0d57d6a55c800a9fecf571a901c9bb', 'scratch-lottery'],
  ['3e0d57d6a55c804dbcd3dff1fed6eb68', 'racecourse'],
  ['3e0d57d6a55c80378750e502be28b30f', 'casino'],
  ['3e0d57d6a55c80f89a7df3aabc93ca53', 'land'],
  ['3e0d57d6a55c80f4bd26e6c22516eb8a', 'debt'],
  ['3ddd57d6a55c80d1a126c09593be5d6e', 'credit'],
  ['3e0d57d6a55c8066b139d896b3c40081', 'repair'],
  ['3e0d57d6a55c80fc99eef96b991ea5df', 'upgrade'],
  ['3e0d57d6a55c80aa89daee3da173adf7', 'faq']
]

for (const [pageId, slug] of legacyRoutes) {
  const response = await fetch(baseUrl + `/page/${pageId}`, {
    redirect: 'manual',
    headers: {
      'user-agent': 'justserver3-production-smoke/1.0'
    }
  })
  const location = response.headers.get('location') || ''
  if (
    ![301, 302, 307, 308].includes(response.status) ||
    !location.includes(`/guide/${slug}`)
  ) {
    failed = true
    console.error(
      `FAIL legacy redirect ${pageId} HTTP ${response.status} location=${location || '(none)'}`
    )
  } else {
    console.log(
      `PASS legacy redirect ${pageId} HTTP ${response.status} -> ${location}`
    )
  }
}

if (failed) process.exitCode = 1
