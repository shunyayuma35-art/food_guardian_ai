import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();
const REQUEST_TIMEOUT_MS = 30000; // 30秒
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(req: NextRequest) {
  try {
    // 入力バリデーション
    const body = await req.json();
    const { imageBase64, mediaType } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: '画像データが無効です。' },
        { status: 400 }
      );
    }

    if (!mediaType || !VALID_MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json(
        { error: 'サポートされていない画像形式です。JPEG, PNG, GIF, WebP をお使いください。' },
        { status: 400 }
      );
    }

    // 画像サイズチェック
    const imageSizeBytes = Math.ceil((imageBase64.length * 3) / 4);
    if (imageSizeBytes > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `画像サイズが大きすぎます。5MB以下の画像をお使いください。（現在: ${Math.ceil(imageSizeBytes / 1024 / 1024)}MB）` },
        { status: 413 }
      );
    }

    // タイムアウト処理付きで API 呼び出し
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
    );

    const response = await Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: 'あなたは食品工場の異物・害虫特定の専門家です。画像を分析し以下の形式で回答してください：\n【異物の種類】\n【推定サイズ・特徴】\n【混入経路の可能性】\n【緊急度】高・中・低\n【推奨対応】',
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: imageBase64 } },
            { type: 'text', text: 'この画像の異物・害虫を特定してください' }
          ]
        }]
      }),
      timeoutPromise
    ]) as any;

    // レスポンス検証
    if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
      return NextResponse.json(
        { error: '予期しないレスポンス形式です。' },
        { status: 500 }
      );
    }

    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || typeof textContent.text !== 'string') {
      return NextResponse.json(
        { error: '画像解析結果が無効です。' },
        { status: 500 }
      );
    }

    const text = textContent.text.trim();
    if (text.length === 0) {
      return NextResponse.json(
        { error: '画像を解析できませんでした。より明確な画像をお試しください。' },
        { status: 422 }
      );
    }

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error('Image Analysis Error:', error);

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: '画像解析がタイムアウトしました。接続を確認して再度お試しください。' },
        { status: 504 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'リクエストの形式が無効です。' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '画像解析中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
