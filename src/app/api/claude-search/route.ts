import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
    system: '食品工場の異物・害虫問題の専門家として【概要】【発生原因】【対策】【法令・基準】の形式で日本語で回答してください。',
    messages: [{ role: 'user', content: `食品工場での異物・害虫問題を調査：${query}` }]
  });
  const text = (response.content as any[])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
  return NextResponse.json({ result: text });
}
