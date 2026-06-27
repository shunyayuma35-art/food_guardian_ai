import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();
const REQUEST_TIMEOUT_MS = 30000; // 30秒

export async function POST(req: NextRequest) {
  try {
    // 入力バリデーション
    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'クエリが無効です。キーワードを入力してください。' },
        { status: 400 }
      );
    }

    if (query.trim().length === 0 || query.trim().length > 500) {
      return NextResponse.json(
        { error: 'クエリは1～500文字で入力してください。' },
        { status: 400 }
      );
    }

    // タイムアウト処理付きで API 呼び出し
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
    );

    const response = await Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
        system: '食品工場の異物・害虫問題の専門家として【概要】【発生原因】【対策】【法令・基準】の形式で日本語で回答してください。',
        messages: [{ role: 'user', content: `食品工場での異物・害虫問題を調査：${query.trim()}` }]
      }),
      timeoutPromise
    ]) as any;

    // レスポンス検証
    if (!response.content || !Array.isArray(response.content)) {
      return NextResponse.json(
        { error: '予期しないレスポンス形式です。' },
        { status: 500 }
      );
    }

    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: '検索結果が見つかりませんでした。別のキーワードをお試しください。' },
        { status: 404 }
      );
    }

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error('Claude API Error:', error);

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: '検索がタイムアウトしました。接続を確認して再度お試しください。' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Claude検索中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
