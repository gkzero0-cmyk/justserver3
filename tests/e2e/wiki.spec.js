const { expect, test } = require('@playwright/test')

test.describe('desktop wiki journeys', () => {
  test('search opens from keyboard and navigates to a matched guide', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: /문서 검색/ })
    ).toBeVisible()
    await page.keyboard.press('Control+K')

    const search = page.getByRole('textbox', { name: /검색/i })
    await expect(search).toBeVisible()
    await search.fill('입장료')

    const results = page.getByRole('listbox', { name: '검색 결과' })
    await expect(results).toBeVisible()
    await expect(results).toContainText('서버규칙')

    const quickAnswer = page.getByRole('button', { name: /빠른 답변/i })
    if (await quickAnswer.count()) {
      await quickAnswer.click()
    } else {
      await page.getByRole('option').first().click()
    }

    await expect(page).toHaveURL(/\/guide\/rules(?:[/?#]|$)/)
  })

  test('legacy page id permanently redirects to readable guide url', async ({ page }) => {
    await page.goto('/page/3dad57d6a55c802aa11adaed7c2c98ff')
    await expect(page).toHaveURL(/\/guide\/rules(?:[/?#]|$)/)
    await expect(page.getByText('서버규칙', { exact: true }).first()).toBeVisible()
  })

  test('text size control persists after reload', async ({ page }) => {
    await page.goto('/')
    const large = page.getByRole('button', { name: 'A+' })
    await large.click()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')
  })

  test('theme selection persists after reload', async ({ page }) => {
    await page.goto('/')

    const toggle = page.getByRole('button', {
      name: /라이트 모드로 전환|다크 모드로 전환/
    })
    await toggle.click()

    const selectedTheme = await page.locator('html').getAttribute('data-theme')
    expect(['light', 'dark']).toContain(selectedTheme)

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      selectedTheme || 'dark'
    )
  })

  test('status dashboard exposes content operations queues', async ({ page }) => {
    await page.goto('/status')
    await expect(page.getByText('콘텐츠 보강 대기열', { exact: true })).toBeVisible()
    await expect(page.getByText('자료 검토 큐', { exact: true })).toBeVisible()
    await expect(page.getByText('검색 UX 분석', { exact: true })).toBeVisible()
    await expect(
      page.getByText('검색 수요 대응 우선순위', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('변경 감지 · FAQ 후보 검토 큐', { exact: true })
    ).toBeVisible()
  })

  test('document page exposes key summary, source status, and revision history', async ({ page }) => {
    await page.goto('/guide/rules')

    await expect(page.getByText('이 문서 핵심', { exact: true })).toBeVisible()
    await expect(page.getByText('원본 문서 연동', { exact: true })).toBeVisible()
    await expect(page.getByText(/데이터 갱신/).first()).toBeVisible()

    await expect(
      page.getByText('문서 변경 이력', { exact: true })
    ).toBeVisible()
    await page.getByText('문서 변경 이력', { exact: true }).click()
    await expect(
      page.getByText('변경 이력 추적 시작', { exact: true })
    ).toBeVisible()
  })

  test('enhancement lab runs a full enhancement interaction', async ({ page }) => {
    await page.goto('/')

    const explore = page.getByRole('button', { name: '위키 탐험 시작' })
    await expect(explore).toBeVisible()
    await explore.click()

    const lab = page.locator('#enhancement-lab')
    await expect(lab.getByText('강화 체험소', { exact: true })).toBeVisible()
    await expect(lab.locator('.enhancement-item-name')).toHaveText(
      '다이아몬드 곡괭이'
    )

    const enhance = lab.getByRole('button', { name: /강화하기/ })
    await expect(enhance).toBeVisible()
    await enhance.click()

    await expect(lab.getByText('강화 중… 장비를 담금질하고 있습니다.')).toBeVisible()
    await expect(
      lab.getByText(/강화 성공|강화 실패|강화 하락|장비 파괴|\+15 달성/)
    ).toBeVisible({ timeout: 3000 })
    await expect(lab.getByText('총 시도', { exact: true })).toBeVisible()
  })

  test('search exposes contextual action shortcuts', async ({ page }) => {
    await page.goto('/')
    const openSearch = page.getByRole('button', { name: /문서 검색/ })
    await expect(openSearch).toBeVisible()
    await openSearch.click()

    const search = page.getByRole('textbox', { name: /검색/i })
    await search.fill('곡괭이 강화')
    await expect(
      page.getByRole('link', { name: /강화 체험소에서 직접 해보기/ })
    ).toBeVisible()

    await search.fill('광질')
    await expect(
      page.getByRole('link', { name: /채광 가이드 바로 보기/ })
    ).toBeVisible()

    await search.fill('초보')
    await expect(
      page.getByRole('link', { name: /뉴비 필독부터 시작하기/ })
    ).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(search).not.toBeVisible()
  })

  test('enhancement lab remains readable on compact desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1226, height: 567 })
    await page.goto('/')
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()
    await expect(page.getByRole('tab', { name: /강화/ })).toHaveAttribute('aria-selected', 'true')

    const lab = page.locator('#enhancement-lab')
    const box = await lab.boundingBox()
    const levelSize = await lab.locator('.enhancement-level-row > strong').evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).fontSize)
    )
    const buttonSize = await lab.locator('.enhancement-primary').evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).fontSize)
    )
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    }))

    expect(box).not.toBeNull()
    expect(levelSize).toBeGreaterThanOrEqual(32)
    expect(buttonSize).toBeGreaterThanOrEqual(14)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 1)

    const buttonBox = await lab.locator('.enhancement-primary').boundingBox()
    expect(buttonBox).not.toBeNull()
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(567)
  })

  test('enhancement lab scales up on wide desktop without panel imbalance', async ({ page }) => {
    await page.setViewportSize({ width: 1585, height: 900 })
    await page.goto('/')
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()

    const lab = page.locator('#enhancement-lab')
    const forge = lab.locator('.enhancement-forge')
    const side = lab.locator('.enhancement-side')
    const pickaxe = lab.locator('.enhancement-slot-shell')

    const [forgeBox, sideBox, pickaxeBox] = await Promise.all([
      forge.boundingBox(),
      side.boundingBox(),
      pickaxe.boundingBox()
    ])

    expect(forgeBox).not.toBeNull()
    expect(sideBox).not.toBeNull()
    expect(pickaxeBox).not.toBeNull()
    expect(forgeBox.width).toBeGreaterThan(sideBox.width * 1.55)
    expect(pickaxeBox.width).toBeGreaterThanOrEqual(210)
  })

  test('enhancement lab expands further on full HD desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()

    const lab = page.locator('#enhancement-lab')
    const pickaxe = await lab.locator('.enhancement-slot-shell').boundingBox()
    const button = await lab.locator('.enhancement-primary').boundingBox()

    expect(pickaxe).not.toBeNull()
    expect(button).not.toBeNull()
    expect(pickaxe.width).toBeGreaterThanOrEqual(270)
    expect(button.height).toBeGreaterThanOrEqual(68)
  })

  test('enhancement lab starts with the louder default volume', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('justserver3:enhancement-volume')
      localStorage.removeItem('justserver3:enhancement-volume-version')
    })
    await page.goto('/')
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()

    const lab = page.locator('#enhancement-lab')
    const volume = lab.getByRole('slider', { name: '강화 효과음 볼륨' })
    await expect(volume).toHaveValue('100')
  })

  test('playground tabs load only the selected feature group', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()

    await expect(page.locator('#enhancement-lab')).toBeVisible()
    const enhancementTab = page.getByRole('tab', { name: /강화/ })
    await enhancementTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /미니게임/ })).toBeFocused()
    await expect(page.getByRole('tab', { name: /미니게임/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#enhancement-lab')).toHaveCount(0)

    await page.getByRole('tab', { name: /탐험 기록/ }).click()
    await expect(page.getByRole('tab', { name: /탐험 기록/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('favorite document persists and appears on home', async ({ page }) => {
    await page.goto('/guide/rules/')
    const favorite = page.getByRole('button', { name: /즐겨찾기/ })
    await favorite.click()
    await expect(favorite).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/')
    await expect(page.getByText('즐겨찾기', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /서버규칙/ }).first()).toBeVisible()
  })

  test('home guide links resolve without 404 responses', async ({ page, request }) => {
    await page.goto('/')
    const hrefs = await page
      .locator('a[href^="/guide/"]')
      .evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute('href')).filter(Boolean))]
      )

    expect(hrefs.length).toBeGreaterThan(3)

    for (const href of hrefs) {
      const response = await request.get(href)
      expect(response.status(), href).toBeLessThan(400)
    }
  })

  test('verified FAQ exposes source-backed answers', async ({ page }) => {
    await page.goto('/guide/faq')

    await expect(
      page.getByText('빠르게 확인하는 서버 규칙', { exact: true })
    ).toBeVisible()
    await expect(page.getByText('11개 확인됨', { exact: true })).toBeVisible()

    const question = page.getByText('무한용암은 몇 개까지 만들 수 있나요?', {
      exact: true
    })
    await question.click()

    await expect(
      page.getByText('개인당 최대 5개까지 허용됩니다.', { exact: true })
    ).toBeVisible()
    await expect(
      page
        .locator('#faq-5')
        .getByRole('link', { name: '원문 규칙 확인 →' })
    ).toBeVisible()
  })
})

test.describe('mobile wiki journeys', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('quick info opens and core guide remains reachable', async ({ page }) => {
    await page.goto('/')

    const quick = page.getByRole('button', { name: /빠른정보/ })
    await expect(quick).toBeVisible()
    await quick.click()

    const dialog = page.getByRole('dialog', { name: '게임 중 빠른보기' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('서버규칙', { exact: true })).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /질문이나 키워드 바로 검색/ })
    ).toBeVisible()
    await expect(
      dialog.getByText('지금 바로 보는 핵심 규칙', { exact: true })
    ).toBeVisible()
    await expect(
      dialog.getByText('개인당 최대 5개까지 허용됩니다.', { exact: true })
    ).toBeVisible()
  })

  test('search modal fits within phone width', async ({ page }) => {
    await page.goto('/')
    const openSearch = page.getByRole('button', { name: /문서 검색/ })
    await expect(openSearch).toBeVisible()
    await openSearch.click()
    await page.getByRole('textbox', { name: /검색/i }).fill('강화')

    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    }))

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 1)
  })

  test('upgrade guide has no horizontal overflow at phone width', async ({ page }) => {
    await page.goto('/guide/upgrade/')
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    }))

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 1)
    await expect(page.getByText('강화 체험소', { exact: false }).first()).toBeVisible()
  })

  test('home has no horizontal overflow at phone width', async ({ page }) => {
    await page.goto('/')
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    }))

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 1)
  })

  test('primary mobile controls meet minimum touch target size', async ({ page }) => {
    await page.goto('/')

    const controls = [
      page.getByRole('button', { name: /문서 검색/ }),
      page.getByRole('button', { name: /라이트 모드로 전환|다크 모드로 전환/ })
    ]

    for (const control of controls) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('captures key responsive layouts for visual review', async ({ page }) => {
    const viewports = [
      { width: 1226, height: 567, name: 'compact-desktop' },
      { width: 1585, height: 738, name: 'wide-desktop' },
      { width: 1920, height: 1080, name: 'full-hd' }
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')
      await page.getByRole('button', { name: '위키 탐험 시작' }).click()
      await page.screenshot({
        path: `test-results/visual/${viewport.name}.png`,
        fullPage: true
      })
    }
  })

  test('reduced motion preference suppresses long transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const duration = await page.locator('.wiki-hero').evaluate((element) =>
      getComputedStyle(element).transitionDuration
    )

    expect(duration === '0s' || duration.includes('0.001')).toBeTruthy()
  })
})
