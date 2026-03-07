import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const emailHtml = `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:20px;font-weight:700;color:#171717;margin:0 0 16px;">Good news.</p>
    <p style="font-size:15px;color:#57534e;line-height:1.6;margin:0 0 24px;">
      We found a compatible language partner for you.<br/>
      Come start your conversation on Mutua.
    </p>
    <a href="${APP_URL}/find-match"
       style="display:inline-block;padding:12px 24px;background:#fbbf24;color:#171717;font-weight:700;border:2px solid #171717;border-radius:8px;text-decoration:none;">
      Start speaking →
    </a>
  </div>
`;

export async function POST(request: Request) {
  const { emails } = await request.json() as { emails: string[] };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !emails?.length) {
    return NextResponse.json({ ok: true });
  }

  await Promise.all(
    emails.map((to: string) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Mutua <hello@mutua.app>',
          to,
          subject: 'We found your language partner on Mutua',
          html: emailHtml,
        }),
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
