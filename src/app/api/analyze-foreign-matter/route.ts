import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'あなたは食品工場の異物・害虫特定の専門家です。画像を分析し以下の形式で回答してください：\n【異物の種類】\n【推定サイズ・特徴】\n【混入経路の可能性】\n【緊急度】高・中・低\n【推奨対応】',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: 'この画像の異物・害虫を特定してください' }
      ]
    }]
  });
  const text = (response.content[0] as any).text;
  return NextResponse.json({ result: text });
}
