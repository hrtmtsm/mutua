import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { reason } = await request.json().catch(() => ({ reason: null }));

  // end_instant_session() itself verifies the caller is a participant and
  // tears down call_status + instant_signaling for both sides atomically.
  const { error } = await auth.rpcDb.rpc('end_instant_session', {
    p_session_id: id,
    p_reason:     reason ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
