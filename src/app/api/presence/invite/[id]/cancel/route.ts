import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  const { error } = await auth.rpcDb.rpc('cancel_call_invite', { p_invite_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
