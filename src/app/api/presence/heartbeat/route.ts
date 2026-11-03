import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error } = await auth.db
    .from('call_presence')
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq('user_id', auth.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
