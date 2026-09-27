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
    const large = page.getByRole('button', { name: '글자 크게' })
    await large.click()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')
  })

  test('text size control visibly scales home, section headings and sidebar copy', async ({ page }) => {
    await page.goto('/')

    const heroCopy = page.locator('.hero-copy > p:last-of-type')
    const sectionHeading = page.locator('.directory-heading h2').first()
    const sidebarLabel = page.locator('.sidebar-category-head strong').first()

    await expect(heroCopy).toBeVisible()
    await expect(sectionHeading).toBeVisible()
    await expect(sidebarLabel).toBeVisible()

    const defaultHero = await heroCopy.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )
    const defaultHeading = await sectionHeading.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )
    const defaultSidebar = await sidebarLabel.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    await page.getByRole('button', { name: '글자 크게' }).click()

    const largeHero = await heroCopy.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )
    const largeHeading = await sectionHeading.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )
    const largeSidebar = await sidebarLabel.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    expect(largeHero).toBeGreaterThan(defaultHero)
    expect(largeHeading).toBeGreaterThan(defaultHeading)
    expect(largeSidebar).toBeGreaterThan(defaultSidebar)
  })

  test('text size control visibly scales document and search result copy', async ({ page }) => {
    await page.goto('/guide/rules/')

    const documentCopy = page.locator('.notion-page-content p').first()
    await expect(documentCopy).toBeVisible()
    const defaultDocument = await documentCopy.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    const openSearch = page.getByRole('button', { name: /문서 검색|전체 문서 검색/ }).first()
    await openSearch.click()
    const search = page.getByRole('textbox', { name: /검색/i })
    await search.fill('강화')
    const resultCopy = page.locator('.search-result-card strong').first()
    await expect(resultCopy).toBeVisible()
    const defaultSearch = await resultCopy.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '글자 크게' }).click()

    const largeDocument = await documentCopy.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    await openSearch.click()
    await page.getByRole('textbox', { name: /검색/i }).fill('강화')
    await expect(resultCopy).toBeVisible()
    const largeSearch = await resultCopy.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    expect(largeDocument).toBeGreaterThan(defaultDocument)
    expect(largeSearch).toBeGreaterThan(defaultSearch)
  })

  test('home reports readable and draft guide counts separately', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/공개 \d+ · 준비 중 \d+/).first()).toBeVisible()
    await expect(page.getByText(/공개 \d+ · 준비 \d+/).first()).toBeVisible()
  })

  test('mining guide exposes source-backed confirmed flow', async ({ page }) => {
    await page.goto('/guide/mining/')
    await expect(
      page.getByRole('heading', { name: '현재 원문에서 확인되는 채광 흐름' })
    ).toBeVisible()
    await expect(page.getByText('야생으로 이동', { exact: true })).toBeVisible()
    await expect(page.getByText('광물 채광 · 판매', { exact: true })).toBeVisible()
    await expect(page.getByText('변동 시세 확인', { exact: true })).toBeVisible()
  })

  test('home navigation avoids legacy page-id links', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('a[href^="/page/"]')).toHaveCount(0)
  })

  test('text size control visibly scales enhancement lab copy', async ({ page }) => {
    await page.setViewportSize({ width: 1584, height: 740 })
    await page.goto('/')
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()

    const lab = page.locator('#enhancement-lab')
    const label = lab.locator('.enhancement-panel-title strong').first()

    const defaultSize = await label.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    await page.getByRole('button', { name: '글자 크게' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')
    const largeSize = await label.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    await page.getByRole('button', { name: '글자 작게' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'small')
    const smallSize = await label.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    expect(largeSize).toBeGreaterThan(defaultSize)
    expect(smallSize).toBeLessThan(largeSize)
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
    await expect(page.getByText(/자동 확인/).first()).toBeVisible()
    await expect(page.getByText(/콘텐츠 변경/).first()).toBeVisible()

    await expect(
      page.getByText('문서 변경 이력', { exact: true })
    ).toBeVisible()
    await page.getByText('문서 변경 이력', { exact: true }).click()
    await expect(
      page.getByText('변경 이력 추적 시작', { exact: true })
    ).toBeVisible()
  })

  test('content maturity UI exposes verified brief flow, draft exits, and guided next steps', async ({ page }) => {
    await page.goto('/guide/mining/')
    await expect(page.getByText('간단 안내', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('이 문서 핵심', { exact: true })).toHaveCount(0)
    await expect(
      page.getByText('원문에서 확인된 채광 흐름', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('야생으로 이동하여 광물을 캘 수 있습니다.', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('광물의 시세는 불규칙적으로 변동됩니다.', { exact: true })
    ).toBeVisible()

    const miningNext = page.locator('.next-exploration .is-primary')
    await expect(miningNext).toContainText('다음 추천 가이드')
    await expect(miningNext).toContainText('장비강화')

    await page.goto('/guide/rules/')
    const rulesNext = page.locator('.next-exploration .is-primary')
    await expect(rulesNext).toContainText('다음 추천 가이드')
    await expect(rulesNext).toContainText('기초설정(뉴비필독)')

    await page.goto('/guide/collection/')
    const draftRelated = page.locator('.draft-related-guides')
    await expect(
      draftRelated.getByText('지금 읽을 수 있는 관련 가이드', {
        exact: true
      })
    ).toBeVisible()
    expect(await draftRelated.getByRole('link').count()).toBeGreaterThanOrEqual(2)
    await expect(page.locator('.next-exploration')).toHaveCount(0)

    await page.goto('/guide/upgrade/')
    await expect(page.getByText('체험 가이드', { exact: true })).toBeVisible()
    await expect(
      page.getByText('강화 체험소는 지금 이용할 수 있습니다.', { exact: true })
    ).toBeVisible()

    await page.goto('/')
    await expect(
      page.getByText('원본 문서 · 5분 주기 자동 확인', { exact: true })
    ).toBeVisible()
    await expect(page.getByText(/마지막 콘텐츠 변경/).first()).toBeVisible()
    await expect(
      page.getByText(/준비 중인 문서 \d+개/).first()
    ).toBeVisible()
    await expect(
      page.getByText('처음 시작 순서 보기', { exact: true })
    ).toBeVisible()

    const recent = page.locator('.recent-updates')
    const visibleUpdateSurfaces =
      (await recent.locator('.recent-update-quiet').count()) +
      (await recent.locator('.recent-update-card').count())
    expect(visibleUpdateSurfaces).toBeGreaterThan(0)
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
      lab.locator('.enhancement-result strong')
    ).toHaveText(/강화 성공|강화 실패|강화 하락|장비 파괴|최대강화 달성/, {
      timeout: 3000
    })
    const runAttempts = lab.locator('.enhancement-run-strip > span').first()
    await expect(runAttempts.getByText('시도', { exact: true })).toBeVisible()
    await expect(runAttempts.locator('strong')).toHaveText('1')
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

    const primaryButton = lab.locator('.enhancement-primary')
    await primaryButton.scrollIntoViewIfNeeded()
    const buttonBox = await primaryButton.boundingBox()
    expect(buttonBox).not.toBeNull()
    expect(buttonBox.y).toBeGreaterThanOrEqual(0)
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(568)
  })

  test('enhancement lab keeps geometry stable and effects larger than the pickaxe', async ({ page }) => {
    await page.setViewportSize({ width: 1584, height: 740 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'justserver3-state-v2',
        JSON.stringify({
          version: 2,
          values: {
            enhancementLab: {
              level: 10,
              attempts: 18,
              successes: 11,
              failures: 6,
              downgrades: 1,
              destroyed: 0,
              best: 10,
              maxWins: 0,
              broken: false,
              history: [],
              run: {
                attempts: 18,
                successes: 11,
                failures: 6,
                downgrades: 1,
                destroyed: 0,
                best: 10
              }
            }
          }
        })
      )
    })

    await page.goto('/')
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()

    const lab = page.locator('#enhancement-lab')
    const forge = lab.locator('.enhancement-forge')
    const side = lab.locator('.enhancement-side')
    const button = lab.locator('.enhancement-primary')
    const pickaxe = lab.locator('.enhancement-pickaxe')

    const geometry = async () => {
      const [forgeBox, sideBox, buttonBox, labBox] = await Promise.all([
        forge.boundingBox(),
        side.boundingBox(),
        button.boundingBox(),
        lab.boundingBox()
      ])
      return {
        forgeBox,
        sideBox,
        buttonBox,
        labBox,
        buttonRelativeY:
          forgeBox && buttonBox ? buttonBox.y - forgeBox.y : null
      }
    }

    const before = await geometry()
    expect(before.forgeBox).not.toBeNull()
    expect(before.sideBox).not.toBeNull()
    expect(
      Math.abs(before.forgeBox.height - before.sideBox.height)
    ).toBeLessThanOrEqual(2)

    const effect = await pickaxe.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const pseudo = getComputedStyle(element, '::after')
      const style = getComputedStyle(element)
      return {
        pickaxeWidth: box.width,
        flashWidth: Number.parseFloat(pseudo.width),
        radius: Number.parseFloat(
          style.getPropertyValue('--enhancement-effect-radius')
        )
      }
    })

    expect(effect.flashWidth).toBeGreaterThanOrEqual(
      effect.pickaxeWidth * 1.35
    )
    expect(effect.radius).toBeGreaterThan(effect.pickaxeWidth / 2)

    await button.click()
    await expect(
      lab.getByText('강화 중… 장비를 담금질하고 있습니다.')
    ).toBeVisible()

    const strikeMotion = await lab.locator('.enhancement-forge-hammer').evaluate(
      (element) => {
        const style = getComputedStyle(element)
        return {
          animationName: style.animationName,
          iterationCount: style.animationIterationCount,
          duration: Number.parseFloat(style.animationDuration)
        }
      }
    )
    expect(strikeMotion.animationName).toContain(
      'enhancementBlacksmithHammerPhysical'
    )
    expect(strikeMotion.iterationCount).toBe('1')
    expect(strikeMotion.duration).toBeGreaterThanOrEqual(.6)

    const charging = await geometry()
    expect(before.buttonRelativeY).not.toBeNull()
    expect(charging.buttonRelativeY).not.toBeNull()
    expect(
      Math.abs(charging.buttonRelativeY - before.buttonRelativeY)
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(charging.labBox.height - before.labBox.height)
    ).toBeLessThanOrEqual(2)

    await expect(lab.locator('.enhancement-result strong')).toHaveText(
      /강화 성공|강화 실패|강화 하락|장비 파괴|최대강화 달성/,
      { timeout: 3000 }
    )

    const after = await geometry()
    expect(after.buttonRelativeY).not.toBeNull()
    expect(
      Math.abs(after.buttonRelativeY - before.buttonRelativeY)
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(after.labBox.height - before.labBox.height)
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(after.forgeBox.height - after.sideBox.height)
    ).toBeLessThanOrEqual(2)
  })

  test('enhancement replace state keeps button and history coordinates fixed with a forge-wide impact layer', async ({ page }) => {
    await page.setViewportSize({ width: 1584, height: 740 })

    const writeState = async (broken) => {
      await page.evaluate((isBroken) => {
        localStorage.setItem(
          'justserver3-state-v2',
          JSON.stringify({
            version: 2,
            values: {
              enhancementLab: {
                level: 11,
                attempts: 19,
                successes: 14,
                failures: 1,
                downgrades: 3,
                destroyed: isBroken ? 1 : 0,
                best: 12,
                maxWins: 0,
                broken: isBroken,
                history: [],
                run: {
                  attempts: 19,
                  successes: 14,
                  failures: 1,
                  downgrades: 3,
                  destroyed: isBroken ? 1 : 0,
                  best: 12
                }
              }
            }
          })
        )
      }, broken)
    }

    await page.goto('/')
    await writeState(false)
    await page.reload()
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()

    const lab = page.locator('#enhancement-lab')
    const forge = lab.locator('.enhancement-forge')
    const button = lab.locator('.enhancement-primary')
    const recent = lab.locator('.enhancement-recent-log')
    const slot = lab.locator('.enhancement-slot-shell')
    const impact = lab.locator('.enhancement-forge-impact')

    const geometry = async () => {
      const [forgeBox, buttonBox, recentBox] = await Promise.all([
        forge.boundingBox(),
        button.boundingBox(),
        recent.boundingBox()
      ])
      return {
        forgeBox,
        buttonBox,
        recentBox,
        buttonRelativeY:
          forgeBox && buttonBox ? buttonBox.y - forgeBox.y : null,
        recentRelativeY:
          forgeBox && recentBox ? recentBox.y - forgeBox.y : null
      }
    }

    const normal = await geometry()
    const [slotBox, impactBox] = await Promise.all([
      slot.boundingBox(),
      impact.boundingBox()
    ])

    expect(slotBox).not.toBeNull()
    expect(impactBox).not.toBeNull()
    expect(impactBox.width).toBeGreaterThan(slotBox.width * 1.5)
    expect(impactBox.height).toBeGreaterThan(slotBox.height * 1.5)

    const hammer = lab.locator('.enhancement-forge-hammer')
    await expect(hammer).toHaveCount(1)
    const hammerArt = await hammer.evaluate((element) => {
      const style = getComputedStyle(element)
      const head = getComputedStyle(element, '::before')
      const impact = element.parentElement?.getBoundingClientRect()
      const left = Number.parseFloat(style.left)
      const top = Number.parseFloat(style.top)
      return {
        handleHeight: Number.parseFloat(style.height),
        headWidth: Number.parseFloat(head.width),
        leftRatio: impact?.width ? left / impact.width : 0,
        topRatio: impact?.height ? top / impact.height : 0,
        transformOrigin: style.transformOrigin
      }
    })
    expect(hammerArt.handleHeight).toBeGreaterThanOrEqual(60)
    expect(hammerArt.headWidth).toBeGreaterThanOrEqual(48)
    expect(hammerArt.leftRatio).toBeGreaterThan(.51)
    expect(hammerArt.leftRatio).toBeLessThan(.59)
    expect(hammerArt.topRatio).toBeGreaterThan(.39)
    expect(hammerArt.topRatio).toBeLessThan(.46)
    expect(hammerArt.transformOrigin).toContain('100%')

    await expect(lab.locator('.enhancement-run-result-slot')).toHaveCount(0)

    await writeState(true)
    await page.reload()
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()

    const brokenLab = page.locator('#enhancement-lab')
    await expect(
      brokenLab.getByRole('button', { name: /새 곡괭이 받기/ })
    ).toBeVisible()

    const brokenForge = brokenLab.locator('.enhancement-forge')
    const brokenButton = brokenLab.locator('.enhancement-primary')
    const brokenRecent = brokenLab.locator('.enhancement-recent-log')
    const [forgeBox, buttonBox, recentBox] = await Promise.all([
      brokenForge.boundingBox(),
      brokenButton.boundingBox(),
      brokenRecent.boundingBox()
    ])

    const brokenGeometry = {
      buttonRelativeY:
        forgeBox && buttonBox ? buttonBox.y - forgeBox.y : null,
      recentRelativeY:
        forgeBox && recentBox ? recentBox.y - forgeBox.y : null
    }

    expect(normal.buttonRelativeY).not.toBeNull()
    expect(normal.recentRelativeY).not.toBeNull()
    expect(brokenGeometry.buttonRelativeY).not.toBeNull()
    expect(brokenGeometry.recentRelativeY).not.toBeNull()
    expect(
      Math.abs(brokenGeometry.buttonRelativeY - normal.buttonRelativeY)
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(brokenGeometry.recentRelativeY - normal.recentRelativeY)
    ).toBeLessThanOrEqual(2)
  })

  test('enhancement lab fits a 740px laptop viewport without clipping its bottom utilities', async ({ page }) => {
    await page.setViewportSize({ width: 1584, height: 740 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'justserver3-state-v2',
        JSON.stringify({
          version: 2,
          values: {
            enhancementLab: {
              level: 7,
              attempts: 14,
              successes: 8,
              failures: 5,
              downgrades: 1,
              destroyed: 0,
              best: 7,
              maxWins: 0,
              broken: false,
              history: [],
              run: {
                attempts: 14,
                successes: 8,
                failures: 5,
                downgrades: 1,
                destroyed: 0,
                best: 7
              }
            }
          }
        })
      )
    })

    await page.goto('/')
    await page.getByRole('button', { name: '위키 탐험 시작' }).click()
    await page.getByRole('button', { name: '글자 크게' }).click()

    const lab = page.locator('#enhancement-lab')
    const forge = lab.locator('.enhancement-forge')
    const side = lab.locator('.enhancement-side')
    const recent = lab.locator('.enhancement-recent-log')
    const records = lab.locator('.enhancement-records')
    const links = lab.locator('.enhancement-links')

    const [labBox, forgeBox, sideBox, recentBox, recordsBox, linksBox] =
      await Promise.all([
        lab.boundingBox(),
        forge.boundingBox(),
        side.boundingBox(),
        recent.boundingBox(),
        records.boundingBox(),
        links.boundingBox()
      ])

    expect(labBox).not.toBeNull()
    expect(forgeBox).not.toBeNull()
    expect(sideBox).not.toBeNull()
    expect(recentBox).not.toBeNull()
    expect(recordsBox).not.toBeNull()
    expect(linksBox).not.toBeNull()

    expect(labBox.height).toBeLessThanOrEqual(650)
    expect(Math.abs(forgeBox.height - sideBox.height)).toBeLessThanOrEqual(2)
    expect(recentBox.y + recentBox.height).toBeLessThanOrEqual(
      forgeBox.y + forgeBox.height + 1
    )
    expect(recordsBox.y + recordsBox.height).toBeLessThanOrEqual(
      sideBox.y + sideBox.height + 1
    )
    expect(linksBox.y + linksBox.height).toBeLessThanOrEqual(
      sideBox.y + sideBox.height + 1
    )
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

  test('document sharing stays available without feedback UI', async ({ page }) => {
    await page.goto('/guide/rules/')

    const actions = page.locator('#document-feedback')
    await expect(actions.getByRole('button', { name: /공유하기/ })).toBeVisible()
    await expect(actions.getByRole('button', { name: /제보하기/ })).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: '제보하기' })).toHaveCount(0)
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

test.describe('core wiki quality regressions', () => {
  test('highest-traffic routes render a single usable page heading', async ({ page }) => {
    for (const path of [
      '/guide/newbie-guide/',
      '/guide/rules/',
      '/guide/mining/',
      '/guide/upgrade/',
      '/guide/faq/'
    ]) {
      await page.goto(path)
      await expect(page.locator('h1:visible')).toHaveCount(1)
      await expect(page.locator('main')).toBeVisible()
    }
  })

  test('source-backed brief guides expose verified summaries', async ({ page }) => {
    const cases = [
      ['/guide/mining/', '원문에서 확인된 채광 핵심'],
      ['/guide/fishing/', '원문에서 확인된 낚시 핵심'],
      ['/guide/cooking/', '원문에서 확인된 요리 핵심']
    ]

    for (const [path, heading] of cases) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await expect(page.locator('.verified-brief-guide li').first()).toBeVisible()
    }
  })

  test('freshness labels separate sync time from document edit time', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/마지막 동기화/).first()).toBeVisible()
    await expect(page.getByText(/최근 문서 수정/).first()).toBeVisible()

    await page.goto('/guide/rules/')
    await expect(page.getByText(/마지막 동기화/).first()).toBeVisible()
    await expect(page.getByText(/문서 수정/).first()).toBeVisible()
  })

  test('draft search results are visibly identified as preparing', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /문서 검색/ }).click()
    const search = page.getByRole('textbox', { name: /검색/i })
    await search.fill('카지노')

    const draft = page.locator('.search-result-card[data-status="draft"]').first()
    await expect(draft).toBeVisible()
    await expect(draft.getByText('준비 중', { exact: true })).toBeVisible()
  })

  test('core response payloads stay within the current performance budget', async ({ request }) => {
    const budgets = [
      ['/guide/newbie-guide/', 400_000],
      ['/guide/api/', 550_000]
    ]

    for (const [path, maxChars] of budgets) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      const body = await response.text()
      expect(body.length, path).toBeLessThan(maxChars)
    }
  })

  test('security headers prevent third-party framing', async ({ request }) => {
    const response = await request.get('/')
    expect(response.headers()['x-frame-options']).toBe('DENY')
    expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  })
})

test.describe('accessibility smoke', () => {
  for (const theme of ['dark', 'light']) {
    test(`${theme} theme keeps core semantics and accessible controls`, async ({ page }) => {
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem('justserver3-theme', selectedTheme)
      }, theme)

      for (const path of ['/', '/guide/rules/']) {
        await page.goto(path)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await expect(page.locator('html')).toHaveAttribute('lang', 'ko')

        const themeToggle = page.getByRole('button', {
          name:
            theme === 'dark'
              ? '라이트 모드로 전환'
              : '다크 모드로 전환'
        })
        await expect(themeToggle).toBeVisible()
        await expect(themeToggle).toHaveAttribute(
          'aria-pressed',
          theme === 'light' ? 'true' : 'false'
        )
        await expect(page.getByRole('main')).toHaveCount(1)

        const h1Count = await page.locator('h1:visible').count()
        expect(h1Count, `${path} should expose one page-level h1`).toBe(1)

        const imageAltIssues = await page.locator('img').evaluateAll((images) =>
          images
            .filter((image) => !image.hasAttribute('alt'))
            .map((image) => image.getAttribute('src') || '(unknown image)')
        )
        expect(imageAltIssues, `${path} images missing alt attributes`).toEqual([])

        const unnamedControls = await page
          .locator('button, a[href], input, select, textarea')
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                if (element.getAttribute('aria-hidden') === 'true') return false
                const aria = element.getAttribute('aria-label')?.trim()
                const labelledBy = element.getAttribute('aria-labelledby')?.trim()
                const title = element.getAttribute('title')?.trim()
                const text = element.textContent?.trim()
                const value =
                  element instanceof HTMLInputElement
                    ? element.value || element.placeholder
                    : ''
                return !aria && !labelledBy && !title && !text && !value
              })
              .map((element) => ({
                tag: element.tagName.toLowerCase(),
                className: element.getAttribute('class') || ''
              }))
          )
        expect(unnamedControls, `${path} unnamed interactive controls`).toEqual([])
      }
    })
  }
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

  test('mobile quick view exposes persistent text-size controls', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /빠른정보/ }).click()
    const dialog = page.getByRole('dialog', { name: '게임 중 빠른보기' })
    const ruleCopy = dialog.locator('.mobile-quick-rule-grid strong').first()

    await expect(dialog.getByText('글자 크기', { exact: true })).toBeVisible()
    await expect(ruleCopy).toBeVisible()

    const defaultSize = await ruleCopy.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )

    await dialog.getByRole('button', { name: '글자 크게' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')

    const largeSize = await ruleCopy.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    )
    expect(largeSize).toBeGreaterThan(defaultSize)

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large')
  })

  test('search modal fits within phone width', async ({ page }) => {
    await page.goto('/')
    const quick = page.getByRole('button', { name: /빠른정보/ })
    await expect(quick).toBeVisible()
    await quick.click()

    const quickDialog = page.getByRole('dialog', { name: '게임 중 빠른보기' })
    const openSearch = quickDialog.getByRole('button', {
      name: /질문이나 키워드 바로 검색/
    })
    await expect(openSearch).toBeVisible()
    await openSearch.click()

    const search = page.getByRole('textbox', { name: /검색/i })
    await expect(search).toBeVisible()
    await search.fill('강화')

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

  test('large text keeps key responsive widths free of horizontal overflow', async ({ page }) => {
    const mobileViewports = [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 412, height: 915 }
    ]

    for (const viewport of mobileViewports) {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page.getByRole('button', { name: /빠른정보/ }).click()
      const dialog = page.getByRole('dialog', { name: '게임 중 빠른보기' })
      await dialog.getByRole('button', { name: '글자 크게' }).click()
      await dialog.getByRole('button', { name: '빠른보기 닫기' }).click()

      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }))
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 1)
    }

    for (const width of [1024, 853]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      const topLarge = page.getByRole('button', { name: '글자 크게' }).first()
      if (await topLarge.isVisible()) {
        await topLarge.click()
      } else {
        await page.getByRole('button', { name: /빠른정보/ }).click()
        const dialog = page.getByRole('dialog', { name: '게임 중 빠른보기' })
        await dialog.getByRole('button', { name: '글자 크게' }).click()
        await dialog.getByRole('button', { name: '빠른보기 닫기' }).click()
      }

      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }))
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport + 1)
    }
  })

  test('primary mobile controls meet minimum touch target size', async ({ page }) => {
    await page.goto('/')

    const controls = [
      page.getByRole('button', { name: /빠른정보/ }),
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

    const mobileViewports = [
      { width: 360, height: 800, name: 'mobile-360' },
      { width: 390, height: 844, name: 'mobile-390' },
      { width: 412, height: 915, name: 'mobile-412' }
    ]

    for (const viewport of mobileViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')
      await page.screenshot({
        path: `test-results/visual/${viewport.name}.png`,
        fullPage: false
      })
      const layoutFitsViewport = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1
      )
      expect(layoutFitsViewport, viewport.name).toBeTruthy()
    }
  })

  test('reduced motion preference suppresses long transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const duration = await page.locator('.wiki-hero').evaluate((element) =>
      getComputedStyle(element).transitionDuration
    )

    const seconds = duration.split(',').map((value) => {
      const normalized = value.trim()
      if (normalized.endsWith('ms')) {
        return Number.parseFloat(normalized) / 1000
      }
      if (normalized.endsWith('s')) {
        return Number.parseFloat(normalized)
      }
      return Number.POSITIVE_INFINITY
    })

    expect(Math.max(...seconds)).toBeLessThanOrEqual(0.001)
  })
})
