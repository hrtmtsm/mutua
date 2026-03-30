import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  // Verify the caller is authenticated
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file      = formData.get('file')      as File | null;
  const sessionId = formData.get('sessionId') as string | null;

  if (!file || !sessionId) {
    return NextResponse.json({ error: 'file and sessionId required' }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Confirm the token belongs to the owner of this sessionId
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('email', user.email!)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const path        = `${sessionId}.jpg`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);

  const { error } = await adminClient.storage
    .from('avatars')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = adminClient.storage.from('avatars').getPublicUrl(path);
  const url = data.publicUrl + '?t=' + Date.now();

  const { error: dbError } = await adminClient
    .from('profiles')
    .upsert({ session_id: sessionId, avatar_url: url }, { onConflict: 'session_id' });

  if (dbError) {
    console.error('Profile avatar_url update failed:', dbError.message);
  }

  return NextResponse.json({ url });
}
