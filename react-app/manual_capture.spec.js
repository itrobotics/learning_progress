import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const OUTPUT_DIR = new URL('../manual_images/', import.meta.url)

function outputPath(name) {
  return `../manual_images/${name}`
}

async function saveScreenshot(target, fileNames, options = {}) {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames]

  for (const name of names) {
    await target.screenshot({
      path: outputPath(name),
      ...options,
    })
  }
}

async function selectUsableStudent(page) {
  const studentItems = page.locator('.student-item')
  const count = await studentItems.count()

  for (let index = 0; index < count; index += 1) {
    await studentItems.nth(index).click()

    const detailCard = page.locator('.detail-card').first()
    await expect(detailCard).toBeVisible({ timeout: 10000 })

    const scheduleTable = page.locator('.sched-table').first()
    const historyTable = page.locator('.history-table').first()

    try {
      await scheduleTable.waitFor({ state: 'visible', timeout: 8000 })
      await historyTable.waitFor({ state: 'visible', timeout: 8000 })
      return
    } catch {
      // try next student
    }
  }

  throw new Error('找不到可用於手冊截圖的學生資料')
}

test('capture manual screenshots with new stable strategy', async ({ page }) => {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  await page.setViewportSize({ width: 1440, height: 2200 })
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.topnav')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.student-item').first()).toBeVisible({ timeout: 30000 })

  await selectUsableStudent(page)

  const topnav = page.locator('.topnav')
  const sidebar = page.locator('.sidebar')
  const sidebarHeader = page.locator('.sidebar-header')
  const main = page.locator('main')
  const detailCard = page.locator('.detail-card').first()
  const detailHeader = detailCard.locator('.detail-header')
  const infoGrid = detailCard.locator('.info-grid').first()
  const inlineToolbar = detailCard.locator('.inline-toolbar')
  const detailSections = detailCard.locator('.detail-section')
  const confirmSection = detailSections.nth(0)
  const scheduleSection = detailSections.nth(1)
  const matrixSection = detailSections.nth(2)

  await expect(detailHeader).toBeVisible({ timeout: 30000 })
  await expect(infoGrid).toBeVisible({ timeout: 30000 })
  await expect(inlineToolbar).toBeVisible({ timeout: 30000 })
  await expect(confirmSection).toBeVisible({ timeout: 30000 })
  await expect(scheduleSection).toBeVisible({ timeout: 30000 })
  await expect(matrixSection).toBeVisible({ timeout: 30000 })

  await page.waitForTimeout(1200)

  await saveScreenshot(page, ['00-home-tall.png', '01-home-full.png', '10-home-with-data.png'], {
    fullPage: true,
  })
  await saveScreenshot(page, '01-home.png')
  await saveScreenshot(topnav, '02-topnav.png')
  await saveScreenshot(sidebarHeader, '03-sidebar-search-filter.png')
  await saveScreenshot(sidebar, '04-student-list.png')
  await saveScreenshot(main, '11-main-with-data.png')
  await saveScreenshot(detailCard, '05-kpi-and-detail-top.png')
  await saveScreenshot(inlineToolbar, '06-detail-actions.png')
  await saveScreenshot(confirmSection, ['07-confirm-panel.png', '13-confirm-section-with-data.png'])
  await saveScreenshot(scheduleSection, ['08-schedule-table.png', '14-schedule-view-with-data.png'])
  await saveScreenshot(matrixSection, ['09-learning-matrix.png', '12-learning-matrix-with-data.png'])

  await page.locator('.nav-menu-btn').filter({ hasText: '書籍訂購' }).click()
  await expect(page.getByText('待訂套書總覽')).toBeVisible({ timeout: 30000 })
  await page.waitForTimeout(1200)

  await saveScreenshot(page, '15-order-summary-with-data.png', { fullPage: true })
})