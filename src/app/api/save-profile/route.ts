import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';
import { LANGUAGES } from '@/lib/types';

export async function POST(request: Request) {
 const auth = await requireAuth(request);
 if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
 const body = await request.json().catch(() => null);
 if (!body || typeof body.session_id !== 'string' || !LANGUAGES.includes(body.native_language) || !LANGUAGES.includes(body.learning_language) || body.native_language === body.learning_language) {
  return NextResponse.json({ error: 'Valid session and language pair required.' }, { status: 400 });
 }
 const { data: existing, error: lookupError } = await auth.db.from('profiles').select('email,availability').eq('session_id',body.session_id).maybeSingle();
 if (lookupError) return NextResponse.json({error:'Could not read profile.'},{status:500});
 const {data:link,error:linkError}=await auth.db.from('legacy_identity_links').select('user_id').eq('legacy_session_id',body.session_id).maybeSingle();
 if(linkError)return NextResponse.json({error:'Identity verification unavailable.'},{status:503});
 if ((link && link.user_id!==auth.userId) || (!link && existing) || (!existing && body.session_id!==auth.userId)) {
  return NextResponse.json({ error: 'legacy_identity_verification_required', message:'既存のデータは保持されています。アカウントとの対応確認が必要です。' }, { status:403 });
 }
 if(!link){
  const created=await auth.db.from('legacy_identity_links').insert({legacy_session_id:auth.userId,user_id:auth.userId,source:'authenticated_creation'});
  if(created.error)return NextResponse.json({error:'Could not verify identity. Retry.'},{status:409});
 }
 // Never accept email, moderation fields, or arbitrary DB columns from the caller.
 const profile: Record<string, unknown> = {
  session_id: body.session_id, email: auth.email.toLowerCase(),
  native_language: body.native_language, learning_language: body.learning_language,
  ...(existing ? {} : {availability:'Flexible'}),
 };
 for (const key of ['name','bio','interests','goal','comm_style','practice_frequency']) {
  if (typeof body[key] === 'string') profile[key] = body[key].slice(0,2000);
 }
 const { error } = existing
  ? await auth.db.from('profiles').update(profile).eq('session_id',body.session_id)
  : await auth.db.from('profiles').insert(profile);
 if (error) return NextResponse.json({ error:'Could not save profile.' }, { status:500 });
 return NextResponse.json({ success:true });
}
