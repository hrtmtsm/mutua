import {NextResponse} from 'next/server';
import {requireAuth} from '@/lib/presenceAuth';
import {liveConfigurationError} from '@/lib/releaseConfig';
import {providerHeaders,providerSession,hangupProvider} from '@/lib/voiceProvider';
export const maxDuration=30;
export async function POST(request:Request){
 const issue=liveConfigurationError();if(issue)return NextResponse.json({error:issue},{status:503});
 const auth=await requireAuth(request);if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const body=await request.json().catch(()=>null);if(!body)return NextResponse.json({error:'invalid_request'},{status:400});
 if(body.action==='close'){
  const row=await auth.db.from('voice_provider_connections').select('*').eq('id',body.connectionId).eq('owner_id',auth.userId).maybeSingle();
  if(!row.data)return NextResponse.json({error:'forbidden'},{status:403});
  if(row.data.closed_at)return NextResponse.json({success:true});
  const closed=await hangupProvider(row.data.provider_call_id);
  await auth.db.from('voice_provider_connections').update(closed?{closed_at:new Date().toISOString(),close_error:null}:{close_error:'hangup_failed'}).eq('id',row.data.id);
  return NextResponse.json({success:closed},{status:closed?200:502});
 }
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'AI接続の設定が未完了です。'},{status:503});
 if(!['ai','transcription'].includes(body.kind)||typeof body.sdp!=='string'||body.sdp.length>65536)return NextResponse.json({error:'invalid_request'},{status:400});
 const owned=await auth.rpcDb.from('voice_sessions').select('*').eq('id',body.sessionId).maybeSingle();
 const s=owned.data;
 if(!s||s.status==='ended'||!s.consent_version||(body.kind==='ai'&&s.partner_type!=='ai')||(body.kind==='transcription'&&s.partner_type!=='human'))return NextResponse.json({error:'この通話では音声処理を開始できません。'},{status:403});
 if(body.kind==='transcription'&&s.status!=='active')return NextResponse.json({error:'相手の音声接続を待っています。'},{status:409});
 const prior=await auth.db.from('voice_provider_connections').select('id').eq('session_id',s.id).eq('owner_id',auth.userId).eq('kind',body.kind).is('closed_at',null).maybeSingle();
 if(prior.data)return NextResponse.json({error:'別のタブで音声処理が接続中です。元のタブで終了してください。'},{status:409});
 let providerId:string|undefined;
 try{
  const form=new FormData();form.set('sdp',body.sdp);form.set('session',JSON.stringify(providerSession(body.kind,s)));
  const upstream=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:providerHeaders(auth.userId),body:form,signal:AbortSignal.timeout(20000)});
  if(!upstream.ok)throw Error([401,403].includes(upstream.status)?'provider_auth_failed':upstream.status===429?'provider_capacity':'provider_connection_failed');
  const location=upstream.headers.get('location');providerId=location?.split('/').pop();if(!providerId)throw Error('provider_session_missing');
  const answer=await upstream.text();
  const current=await auth.rpcDb.from('voice_sessions').select('status').eq('id',s.id).single();
  if(request.signal.aborted||current.data?.status==='ended')throw Error('connection_cancelled');
  const row=await auth.db.from('voice_provider_connections').insert({session_id:s.id,owner_id:auth.userId,provider_call_id:providerId,kind:body.kind}).select('id').single();
  if(row.error)throw Error(row.error.code==='23505'?'provider_duplicate':'connection_save_failed');
  return NextResponse.json({sdp:answer,connectionId:row.data.id,manualCommit:body.kind==='transcription'&&process.env.OPENAI_LIVE_TRANSCRIPTION_MODEL==='gpt-live-transcribe'},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(providerId)await hangupProvider(providerId);
  if(!(error instanceof Error&&error.message==='provider_duplicate'))await auth.rpcDb.rpc('practice_action',{p_action:body.kind==='ai'?'end':'transcript_status',p_data:body.kind==='ai'?{sessionId:s.id,reason:'provider_failure'}:{sessionId:s.id,status:'partial'}});
  const code=error instanceof Error?error.message:'provider_connection_failed';
  return NextResponse.json({error:code==='provider_auth_failed'?'AIサービスの認証に失敗しました。接続設定を確認してください。':'AIサービスに接続できませんでした。会話ログはそのまま閲覧できます。',code},{status:502});
 }
}
