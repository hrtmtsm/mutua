import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend   = new Resend(process.env.RESEND_API_KEY);
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trymutua.com';

function emailHtml(ctaUrl: string, nativeLanguage: string, targetLanguage: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:#1a6fb5 url(https://trymutua.com/sky.jpg) center/cover no-repeat;padding:40px 40px 32px;">
              <p style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;text-shadow:0 1px 4px rgba(0,0,0,0.3);">Mutua</p>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);text-shadow:0 1px 3px rgba(0,0,0,0.2);">Your language exchange community</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111111;line-height:1.2;">
                Your language partner<br/>is waiting for you.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#666666;line-height:1.6;">
                Someone who speaks <strong style="color:#111;">${nativeLanguage}</strong> natively and wants to practice <strong style="color:#111;">${targetLanguage}</strong> — just like you — is ready to connect on Mutua.
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#666666;line-height:1.6;">
                Click below to set up your profile and meet them.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(160deg,#60bdff 0%,#2B8FFF 40%,#1060d8 100%);border-radius:12px;box-shadow:0 4px 14px rgba(43,143,255,0.35)">
                    <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      Meet your partner →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
                You're receiving this because you signed up for Mutua.<br/>
                <a href="https://trymutua.com" style="color:#aaaaaa;">trymutua.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  const { email, nativeLanguage, targetLanguage } = await request.json();
  if (!email || !nativeLanguage || !targetLanguage) {
    return NextResponse.json({ error: 'email, nativeLanguage, and targetLanguage are required' }, { status: 400 });
  }

  // Generate a Supabase magic link so clicking the email creates a real auth session.
  // Falls back to the sign-in page if service role key is missing.
  let ctaUrl = `${APP_URL}/auth/send`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });
    if (linkData?.properties?.action_link) {
      ctaUrl = linkData.properties.action_link;
    }
  }

  const { error: sendError } = await resend.emails.send({
    from: 'Mutua <hello@trymutua.com>',
    to: email,
    subject: 'Your language partner is here',
    html: emailHtml(ctaUrl, nativeLanguage, targetLanguage),
  });

  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
