import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { to } = await request.json();
  if (!to) return NextResponse.json({ error: 'to (uuid) required' }, { status: 400 });

  // auth.uid() inside send_call_invite() resolves from this request's own
  // token via rpcDb — "self" is never taken from the request body.
  const { data, error } = await auth.rpcDb.rpc('send_call_invite', { p_to: to });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ inviteId: data });
}
