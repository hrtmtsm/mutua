import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';
import {liveConfigurationError} from '@/lib/releaseConfig';

const MESSAGES: Record<string,string> = {
 not_authenticated: 'ログインしてください。', complete_profile_first: 'プロフィールで母語と学習言語を設定してください。',
 invalid_language_pair:'母語と学習言語を確認してください。', ai_session_active:'AI通話を終了してから相手を探してください。', legacy_identity_verification_required:'以前のプロフィールとの本人確認が必要です。データは保持されています。',
 choose_different_languages: '母語と学習言語は別の言語を選んでください。',
 conversation_ended: '会話は終了しています。次の相手を探してください。',
 invite_no_longer_ringing: 'この通話の招待は期限切れ、または既に応答済みです。',
 call_not_active: 'この通話は終了しています。', account_suspended: 'このアカウントは利用を停止されています。',
};
const ACTIONS = new Set(['state','join','cancel','message','invite','accept','decline','cancel_invite','end_call','end','signal']);
export async function POST(request: Request) {
 const configurationError=liveConfigurationError();
 if(configurationError)return NextResponse.json({error:configurationError},{status:503});
 try {
  const body = await request.json();
  if (!ACTIONS.has(body.action) || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
   return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.rpcDb.rpc('live_exchange', { p_action: body.action, p_data: body.data });
  if (error) {
   console.error('[live-exchange]', error.message);
   return NextResponse.json({ error: MESSAGES[error.message] || '操作を完了できませんでした。画面を確認して、もう一度お試しください。' }, { status: 400 });
  }
  if (data?.error) return NextResponse.json({ error: MESSAGES[data.error] || 'この操作は現在利用できません。' }, { status: 409 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
 } catch {
  return NextResponse.json({ error: 'リクエストを処理できませんでした。再試行してください。' }, { status: 500 });
 }
}
