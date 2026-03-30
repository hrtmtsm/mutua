import { NextResponse } from 'next/server';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const emailHtml = `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:20px;font-weight:700;color:#171717;margin:0 0 16px;">We found your match.</p>
    <p style="font-size:15px;color:#57534e;line-height:1.6;margin:0 0 24px;">
      A compatible language exchange partner just joined Mutua.<br/><br/>
      We're putting the finishing touches on the call feature. We'll reach out as soon as you can connect.
    </p>
    <p style="font-size:13px;color:#78716c;margin:0;">— The Mutua team</p>
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
          from: 'Mutua <hello@trymutua.com>',
          to,
          subject: 'We found your language partner on Mutua',
          html: emailHtml,
        }),
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
