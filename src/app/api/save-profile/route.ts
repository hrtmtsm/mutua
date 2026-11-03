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
 const { data: existing } = await auth.db.from('profiles').select('email').eq('session_id',body.session_id).maybeSingle();
 if (existing && existing.email?.toLowerCase() !== auth.email.toLowerCase()) {
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
 }
 // Never accept email, moderation fields, or arbitrary DB columns from the caller.
 const profile: Record<string, unknown> = {
  session_id: body.session_id, email: auth.email.toLowerCase(),
  native_language: body.native_language, learning_language: body.learning_language,
  availability: 'Flexible',
 };
 for (const key of ['name','bio','interests','goal','comm_style','practice_frequency']) {
  if (typeof body[key] === 'string') profile[key] = body[key].slice(0,2000);
 }
 const { error } = await auth.db.from('profiles').upsert(profile,{ onConflict:'session_id' });
 if (error) return NextResponse.json({ error:'Could not save profile.' }, { status:500 });
 return NextResponse.json({ success:true });
}
