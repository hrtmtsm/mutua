import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function GET(request: Request) { return recording(request); }
export async function POST(request: Request) { return recording(request); }
export async function DELETE(request: Request) { return recording(request); }

async function recording(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get('sessionId');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });

  const { data, error } = await auth.db.from('voice_sessions')
    .select('id, started_at').eq('id', id).eq('user_a', auth.userId)
    .eq('partner_type', 'ai').maybeSingle();
  if (error) return new Response(null, { status: 503 });
  if (!data?.started_at) return new Response(null, { status: 404 });

  const bucket = auth.db.storage.from('call-recordings');
  const path = `${auth.userId}/${data.id}`;
  if (request.method === 'POST') {
    const type = request.headers.get('content-type')?.split(';')[0];
    if (type !== 'audio/webm' && type !== 'audio/mp4') return new Response(null, { status: 415 });
    const size = Number(request.headers.get('content-length'));
    if (!size || size > 3500000) return new Response(null, { status: 413 });
    const audio = await request.arrayBuffer();
    if (audio.byteLength !== size) return new Response(null, { status: 400 });
    const result = await bucket.upload(path, audio, { contentType: type });
    return new Response(null, { status: result.error ? 503 : 201 });
  }
  if (request.method === 'DELETE') {
    const result = await bucket.remove([path]);
    return new Response(null, { status: result.error ? 503 : 204 });
  }
  const result = await bucket.download(path);
  if (result.error || !result.data) return new Response(null, { status: 404 });
  return new Response(result.data, { headers: { 'Cache-Control': 'private, no-store', 'Content-Type': result.data.type } });
}
