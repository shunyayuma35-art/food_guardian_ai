import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const REQUEST_TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = '食品工場の異物・害虫問題の専門家として【概要】【発生原因】【対策】【法令・基準】の形式で日本語で回答してください。';

export async function POST(req: NextRequest) {
  try {
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

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS)
    );

    const userMessage = `食品工場での異物・害虫問題を調査：${query.trim()}`;
    let text: string;

    if (process.env.AI_PROVIDER === 'gemini') {
      // ── Gemini (Vertex AI) + Google Search グラウンディング ──────────────
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT ?? '',
        location: process.env.GOOGLE_CLOUD_LOCATION ?? 'asia-northeast1',
      });

      const response = await Promise.race([
        ai.models.generateContent({
          model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ googleSearch: {} }],
            maxOutputTokens: 1000,
          } as Parameters<typeof ai.models.generateContent>[0]['config'],
        }),
        timeoutPromise,
      ]) as Awaited<ReturnType<typeof ai.models.generateContent>>;

      text = response.text ?? '';
    } else {
      // ── Anthropic + web_search ────────────────────────────────────────────
      const client = new Anthropic();
      const response = await Promise.race([
        client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          tools: [{ type: 'web_search_20250305' as 'web_search_20250305', name: 'web_search' }],
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
        timeoutPromise,
      ]) as Anthropic.Message;

      if (!response.content || !Array.isArray(response.content)) {
        return NextResponse.json({ error: '予期しないレスポンス形式です。' }, { status: 500 });
      }

      text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('\n');
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: '検索結果が見つかりませんでした。別のキーワードをお試しください。' },
        { status: 404 }
      );
    }

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error('AI Search Error:', error);

    if (error instanceof Error && error.message === 'Request timeout') {
      return NextResponse.json(
        { error: '検索がタイムアウトしました。接続を確認して再度お試しください。' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'AI検索中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}
