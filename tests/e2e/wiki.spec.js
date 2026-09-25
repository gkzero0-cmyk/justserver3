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
      page.getByRole('link', { name: '원문 규칙 확인 →' }).nth(4)
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
  })

  test('home has no horizontal overflow at phone width', async ({ page }) => {
    await page.goto('/')
    const metrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    }))

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 1)
  })
})
