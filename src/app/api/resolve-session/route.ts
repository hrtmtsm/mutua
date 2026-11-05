import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/presenceAuth';
export async function POST(request: Request) {
 const auth = await requireAuth(request);
 if (!auth.ok) return NextResponse.json({ error:auth.error }, { status:auth.status });
 const { data, error } = await auth.db.from('profiles').select('session_id').eq('email',auth.email.toLowerCase()).order('created_at').limit(1).maybeSingle();
 if (error) return NextResponse.json({ error:'Could not resolve profile.' }, { status:500 });
 return NextResponse.json({ sessionId:data?.session_id ?? auth.userId });
}
