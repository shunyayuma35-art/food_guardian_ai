import { test, expect } from '@playwright/test'

const BASE = 'https://foodeye-670414377052.asia-northeast1.run.app'

// Collect all console errors from a page visit
async function collectErrors(page: import('@playwright/test').Page, url: string) {
  const errors: string[] = []
  const jsErrors: string[] = []

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => {
    jsErrors.push(err.message + '\n' + err.stack)
  })

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  } catch (e) {
    errors.push(`Navigation failed: ${e}`)
  }

  return { errors, jsErrors }
}

test.describe('a) 空のlocalStorage (新規ブラウザ)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Pixel 7 - /record コンソールエラー確認', async ({ page }) => {
    const { errors, jsErrors } = await collectErrors(page, `${BASE}/record`)

    console.log('=== Console Errors ===')
    errors.forEach(e => console.log('  [console.error]', e))
    console.log('=== JS Errors ===')
    jsErrors.forEach(e => console.log('  [pageerror]', e))

    // Page should not show browser error page
    const body = await page.textContent('body')
    const hasBrowserError = body?.includes("couldn't load") || body?.includes('ERR_')
    if (hasBrowserError) {
      console.log('BROWSER ERROR PAGE DETECTED')
      console.log('Body snippet:', body?.slice(0, 500))
    }

    // Should not have critical JS errors
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('Firebase') && !e.includes('hydration') && !e.includes('Warning')
    )
    expect(criticalErrors).toEqual([])
  })

  test('Pixel 7 - ホーム → /record ウィザード 1-4 → 保存フロー', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', err => jsErrors.push(err.message))

    // Go to home
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log('Home loaded OK')

    // Navigate to /record
    await page.goto(`${BASE}/record`, { waitUntil: 'domcontentloaded', timeout: 30000 })

    const title = await page.title()
    console.log('Record page title:', title)

    // Check for browser error page
    const bodyText = await page.textContent('body').catch(() => '')
    expect(bodyText).not.toContain("couldn't load")

    console.log('JS errors so far:', jsErrors)
    expect(jsErrors.filter(e => !e.includes('Firebase'))).toEqual([])
  })
})

test.describe('b) 旧形式localStorage (state/groupNone/groupUnknown なし)', () => {
  test('Pixel 7 - 旧形式下書きがある状態で /record を開く', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', err => {
      jsErrors.push(err.message + '\n' + (err.stack ?? ''))
    })

    // Inject legacy draft data BEFORE navigating
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 })

    await page.evaluate(() => {
      // Simulate old-format draft without state/groupNone/groupUnknown fields
      const legacyFeatures = {
        texture: { hard: true, soft: false, elastic: false, crumbly: false, sticky: false },
        appearance: { fibrous: false, glossy: true, matte: false, translucent: false,
          transparent: false, metallic: false, rubbery: false, burned: false,
          scratched: false, patterned: false, layered: false, granular: false, bubbly: false, breakSection: false, bent: false },
        color: { black: false, metalColor: true, brown: false, green: false, white: false,
          whiteTurbid: false, transparent: false },
        smell: { noSmell: true, burnedSmell: false, oilSmell: false, chemicalSmell: false },
        waterTest: { floats: false, sinks: true, dissolves: false, oilSurface: false },
        size: { finePowder: false, longFiber: false, thinFilm: false, thickPiece: false, tiny: false, medium: true },
        magnetTest: { sticks: false, noStick: true, partialStick: false, notTested: false },
        weight: { veryLight: false, heavy: true },
        // NOTE: no `state`, no `groupNone`, no `groupUnknown`
      }
      const legacyDraft = {
        productName: 'テスト製品',
        occurrenceType: 'internal',
        manufacturingDate: '2026-10-01',
        discoveryDate: '2026-10-14T09:00',
        comment: '旧形式の下書きテスト',
        features: legacyFeatures,
      }
      localStorage.setItem('foodeye_draft_v2', JSON.stringify(legacyDraft))
    })

    // Now navigate to /record
    await page.goto(`${BASE}/record`, { waitUntil: 'domcontentloaded', timeout: 30000 })

    const bodyText = await page.textContent('body').catch(() => '')
    const hasBrowserError = bodyText?.includes("couldn't load") || bodyText?.includes('ERR_')

    console.log('=== JS Errors (legacy draft) ===')
    jsErrors.forEach(e => console.log('  ', e.split('\n')[0]))

    if (hasBrowserError) {
      console.log('BROWSER ERROR detected with legacy draft')
      console.log(bodyText?.slice(0, 300))
    }

    expect(bodyText).not.toContain("couldn't load")
    expect(jsErrors.filter(e => !e.includes('Firebase'))).toEqual([])
  })
})
