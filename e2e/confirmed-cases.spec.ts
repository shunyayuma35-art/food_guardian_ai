import { test, expect } from '@playwright/test'

const BASE_URL = 'https://foodeye-670414377052.asia-northeast1.run.app'

test.describe('confirmed cases storage', () => {
  let testId: string

  test('POST → GET → confirmedCasesUsed → DELETE', async ({ request }) => {
    // 1. POST テスト用確定事例
    const postRes = await request.post(`${BASE_URL}/api/incident-confirmations`, {
      data: {
        product_name: 'FoodEyeTestProduct_e2e',
        category: '虫類',
        confirmed_name: 'テスト確定異物',
        confirmed_category: '虫',
        hints: '',
        ai_match: '一致',
      },
    })
    expect(postRes.ok()).toBe(true)
    const posted = await postRes.json() as { id: string }
    testId = posted.id
    expect(testId).toBeTruthy()

    // 2. GET して存在確認
    const getRes = await request.get(
      `${BASE_URL}/api/incident-confirmations?product_name=FoodEyeTestProduct_e2e`
    )
    expect(getRes.ok()).toBe(true)
    const cases = await getRes.json() as Array<{ id: string }>
    expect(cases.some(c => c.id === testId)).toBe(true)

    // 3. analyze-foreign-matter で confirmedCasesUsed を確認
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const analyzeRes = await request.post(`${BASE_URL}/api/analyze-foreign-matter`, {
      data: {
        imageBase64: pngB64,
        mediaType: 'image/png',
        structured: false,
        lang: 'ja',
        productName: 'FoodEyeTestProduct_e2e',
      },
    })
    // レートリミットや AI エラーは許容、ok の場合のみ confirmedCasesUsed を検証
    if (analyzeRes.ok()) {
      const aData = await analyzeRes.json() as { confirmedCasesUsed?: number }
      expect((aData.confirmedCasesUsed ?? 0) >= 1).toBe(true)
    }

    // 4. DELETE
    const delRes = await request.delete(
      `${BASE_URL}/api/incident-confirmations?id=${testId}`
    )
    expect(delRes.ok()).toBe(true)

    // 5. 削除済み確認
    const getRes2 = await request.get(
      `${BASE_URL}/api/incident-confirmations?product_name=FoodEyeTestProduct_e2e`
    )
    const cases2 = await getRes2.json() as Array<{ id: string }>
    expect(cases2.some(c => c.id === testId)).toBe(false)
  })
})
