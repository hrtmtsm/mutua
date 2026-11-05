import {NextResponse} from 'next/server';
import {adminClient} from '@/lib/presenceAuth';
import {liveConfigurationError} from '@/lib/releaseConfig';
import {hangupProvider} from '@/lib/voiceProvider';
export const maxDuration=60;
/** Schedule every minute. Never exposes IDs, transcripts, or provider credentials. */
export async function GET(request:Request){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'unauthorized'},{status:401});
 const issue=liveConfigurationError();if(issue)return NextResponse.json({error:issue},{status:503});
 const db=adminClient();const cleanup=await db.rpc('cleanup_voice_sessions');if(cleanup.error)return NextResponse.json({error:'cleanup_failed'},{status:500});
 const rows=await db.from('voice_provider_connections').select('id,session_id,provider_call_id,expires_at,voice_sessions(status)').is('closed_at',null).order('expires_at').limit(100);
 if(rows.error)return NextResponse.json({error:'cleanup_failed'},{status:500});
 let closed=0,failed=0;
 const candidates=(rows.data||[]).filter(c=>{const session=c.voice_sessions as unknown as {status:string};return session?.status==='ended'||new Date(c.expires_at).getTime()<=Date.now();}).slice(0,20);
 for(let i=0;i<candidates.length;i+=5)await Promise.all(candidates.slice(i,i+5).map(async c=>{
  const ok=await hangupProvider(c.provider_call_id);const saved=await db.from('voice_provider_connections').update(ok?{closed_at:new Date().toISOString(),close_error:null}:{close_error:'hangup_failed'}).eq('id',c.id);if(ok&&!saved.error)closed++;else failed++;
 }));
 return NextResponse.json({closed,failed},{status:failed?502:200});
}
