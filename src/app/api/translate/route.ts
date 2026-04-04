import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { text, targetLanguage } = await req.json();
  if (!text || !targetLanguage) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 256,
    messages: [
      {
        role: 'system',
        content: 'You are a translator. Translate the user\'s message to the requested language. Reply with only the translation — no explanation, no quotes.',
      },
      {
        role: 'user',
        content: `Translate to ${targetLanguage}:\n${text}`,
      },
    ],
  });

  const translation = completion.choices[0].message.content ?? '';
  return NextResponse.json({ translation });
}
