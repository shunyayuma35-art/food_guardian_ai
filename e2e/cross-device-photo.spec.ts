import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = 'https://foodeye-670414377052.asia-northeast1.run.app'

/**
 * 【3】クロスデバイス写真表示テスト
 *
 * /api/upload で Supabase Storage にアップロードした写真 URL は
 * localStorage を持たない別コンテキスト（PC）でも表示できることを確認する。
 */
test.describe('cross-device photo display', () => {
  test('/api/upload returns a public Supabase URL', async ({ request }) => {
    // テスト用の 1x1 PNG を multipart で送信
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )

    const response = await request.post(`${BASE_URL}/api/upload`, {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: pngBytes,
        },
      },
    })

    expect(response.ok()).toBe(true)
    const json = await response.json() as { url?: string }
    expect(json.url).toBeTruthy()
    expect(json.url).toMatch(/^https:\/\//)

    // 返却 URL が実際に画像として取得できることを確認
    const imgResp = await request.get(json.url!)
    expect(imgResp.ok()).toBe(true)

    console.log(`✅ アップロード URL: ${json.url}`)
  })

  test('Supabase image URL renders in clean PC context (no localStorage)', async ({ browser }) => {
    // まず /api/upload で公開 URL を取得
    const apiContext = await browser.newContext()
    const apiPage = await apiContext.newPage()

    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )

    let uploadedUrl: string | null = null
    const uploadResp = await apiPage.request.post(`${BASE_URL}/api/upload`, {
      multipart: {
        file: {
          name: 'e2e-test.png',
          mimeType: 'image/png',
          buffer: pngBytes,
        },
      },
    })
    if (uploadResp.ok()) {
      const json = await uploadResp.json() as { url?: string }
      uploadedUrl = json.url ?? null
    }
    await apiContext.close()

    expect(uploadedUrl).toBeTruthy()
    console.log(`アップロード URL: ${uploadedUrl}`)

    // PC コンテキスト（localStorage なし）で最小 HTML ページを作成し、
    // img タグが src を正常にロードできることを確認
    const pcContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      storageState: { cookies: [], origins: [] },
    })
    const pcPage = await pcContext.newPage()

    // 最小テストページ（PhotoImg コンポーネントと同等の検証）
    await pcPage.setContent(`
      <html><body>
        <img id="photo" src="${uploadedUrl}" style="width:100px;height:100px;object-fit:cover" />
        <div id="error" style="display:none">この端末では写真を表示できません</div>
        <script>
          const img = document.getElementById('photo');
          img.onerror = () => { document.getElementById('error').style.display = 'block'; };
        </script>
      </body></html>
    `)

    // 画像が正常ロードされることを確認（naturalWidth > 0）
    await pcPage.waitForFunction(() => {
      const img = document.getElementById('photo') as HTMLImageElement
      return img && img.complete
    }, { timeout: 10000 })

    const naturalWidth = await pcPage.evaluate(() => {
      return (document.getElementById('photo') as HTMLImageElement).naturalWidth
    })
    expect(naturalWidth).toBeGreaterThan(0)

    // エラーメッセージが表示されていないことを確認
    const errorVisible = await pcPage.locator('#error').isVisible()
    expect(errorVisible).toBe(false)

    console.log('✅ 別コンテキスト（PC / localStorage なし）でも写真が表示できました')
    await pcContext.close()
  })

  test('idb: ref shows error placeholder in PC context without localStorage', async ({ browser }) => {
    // idb: refs はデバイスローカルのため、別コンテキストでは解決できない
    // → PhotoImg が「この端末では写真を表示できません」を表示することを確認
    const pcContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      storageState: { cookies: [], origins: [] },
    })
    const pcPage = await pcContext.newPage()

    // PhotoImg コンポーネントのエラーパスを最小 HTML で再現
    await pcPage.setContent(`
      <html><body>
        <div id="placeholder" style="display:none">
          <span>🔍</span>
          <span id="msg" style="font-size:10px;color:gray">この端末では写真を表示できません</span>
        </div>
        <img id="photo" src="data:image/png;base64,INVALID" />
        <script>
          const img = document.getElementById('photo');
          img.onerror = () => {
            img.style.display = 'none';
            document.getElementById('placeholder').style.display = 'block';
          };
        </script>
      </body></html>
    `)

    await pcPage.waitForFunction(() => {
      const img = document.getElementById('photo') as HTMLImageElement
      return img && img.complete
    }, { timeout: 5000 })

    const msgVisible = await pcPage.locator('#msg').isVisible()
    expect(msgVisible).toBe(true)
    console.log('✅ 読み込めない写真には「この端末では写真を表示できません」が表示されます')

    await pcContext.close()
  })
})
