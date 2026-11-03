import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { accept } = await request.json();
  if (typeof accept !== 'boolean') {
    return NextResponse.json({ error: 'accept (boolean) required' }, { status: 400 });
  }

  // respond_call_invite() itself verifies the caller is the invite's
  // to_user_id (via auth.uid()) — this route doesn't need to re-check that.
  // Returns 'accepted:<sessionId>' | 'declined' | 'expired' — expiry is a
  // routine result, not an error (see the function's own comment for why
  // it must not be signaled via a raised exception).
  const { data, error } = await auth.rpcDb.rpc('respond_call_invite', {
    p_invite_id: id,
    p_accept:    accept,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const result = data as string;
  if (result.startsWith('accepted:')) {
    return NextResponse.json({ result: 'accepted', sessionId: result.slice('accepted:'.length) });
  }
  return NextResponse.json({ result }); // 'declined' | 'expired'
}
