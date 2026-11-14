import type { Utterance } from '@/lib/practice';
import {NextResponse} from 'next/server';
import {requireAuth} from '@/lib/presenceAuth';
import {liveConfigurationError,VOICE_TOPICS,PRACTICE_LEVELS} from '@/lib/releaseConfig';
const ACTIONS=new Set(['state','ai_begin','connected','heartbeat','end','utterance','transcript_status','detail']);
export async function GET(request:Request){
 const issue=liveConfigurationError();if(issue)return NextResponse.json({error:issue},{status:503});
 const auth=await requireAuth(request);if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const {searchParams}=new URL(request.url);
 if(searchParams.has('capabilities'))return NextResponse.json({ai:!!process.env.OPENAI_API_KEY,transcription:!!process.env.OPENAI_API_KEY,review:!!process.env.OPENAI_API_KEY});
 const detailId = searchParams.get('call');
 if (detailId !== null) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(detailId)) {
   return NextResponse.json({error:'invalid_request'},{status:400});
  }
  const headers = {'Cache-Control':'no-store'};
  if (searchParams.has('chat')) {
   const {data,error} = await auth.rpcDb.from('reflection_threads')
    .select('messages:reflection_messages(id,request_id,role,body,quoted_utterance_ids,status,error_code,created_at)')
    .eq('session_id',detailId).eq('owner_id',auth.userId)
    .order('ordinal',{referencedTable:'messages',ascending:true}).maybeSingle();
   if (error) return NextResponse.json({error:'チャット履歴を読み込めませんでした。'},{status:500,headers});
   return NextResponse.json(data?.messages ?? [],{headers});
  }
  const {data,error} = await auth.rpcDb.from('voice_sessions')
   .select('*,utterances:voice_utterances(*)').eq('id',detailId)
   .eq('utterances.final',true)
   .order('sequence',{referencedTable:'utterances',ascending:true}).maybeSingle();
  if (error) return NextResponse.json({error:'通話ログを読み込めませんでした。'},{status:500,headers});
  if (!data) return NextResponse.json({error:'通話が見つかりません。'},{status:404,headers});
  const {utterances,...session} = data;
  utterances.sort((a: Utterance,b: Utterance) => (a.offset_ms ?? 0) - (b.offset_ms ?? 0) ||
   a.sequence - b.sequence || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return NextResponse.json({session,utterances,thread:null,reflection:[]},{headers});
 }
 if(searchParams.has('history')){
  const cursor=searchParams.get('cursor');
  const [createdAt,id]=cursor?.split('|') ?? [];
  if(cursor && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt) ||
     !Number.isFinite(Date.parse(createdAt)) ||
     !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id ?? ''))){
   return NextResponse.json({error:'invalid_cursor'},{status:400});
  }
  const pageSize=cursor ? (searchParams.get('size') === '15' ? 15 : 20) : 5;
  let query=auth.rpcDb.from('voice_sessions')
   .select('id,partner_type,started_at,learning_language_a,created_at')
   .or(`user_a.eq.${auth.userId},user_b.eq.${auth.userId}`)
   .not('started_at','is',null)
   .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(pageSize+1);
  if(cursor)query=query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  const {data,error}=await query;
  if(error)return NextResponse.json({error:'履歴を読み込めませんでした。再試行してください。'},{status:500});
  const sessions=data.slice(0,pageSize);
  const last=sessions.at(-1);
  const nextCursor=data.length>pageSize && last ? `${last.created_at}|${last.id}` : null;
  return NextResponse.json({sessions,nextCursor},{headers:{'Cache-Control':'no-store'}});
 }
 const [voice,legacy,profiles]=await Promise.all([
  auth.rpcDb.from('voice_sessions').select('*').or(`user_a.eq.${auth.userId},user_b.eq.${auth.userId}`).not('started_at','is',null).order('created_at',{ascending:false}).limit(100),
  auth.rpcDb.from('session_logs').select('*').order('ended_at',{ascending:false}).limit(100),
  auth.rpcDb.from('profiles').select('session_id'),
 ]);
 if(voice.error||legacy.error)return NextResponse.json({error:'履歴を読み込めませんでした。再試行してください。'},{status:500});
 const ids=(profiles.data||[]).map(p=>p.session_id);
 const links=await auth.db.from('legacy_identity_links').select('legacy_session_id').eq('user_id',auth.userId).in('legacy_session_id',ids);
 return NextResponse.json({userId:auth.userId,sessions:voice.data,legacy:legacy.data,legacyAccessNeedsReview:ids.length>(links.data?.length||0)},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const issue=liveConfigurationError();if(issue)return NextResponse.json({error:issue},{status:503});
 const auth=await requireAuth(request);if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 try{
  const {action,data={}}=await request.json();if(!ACTIONS.has(action)||!data||typeof data!=='object'||Array.isArray(data))return NextResponse.json({error:'invalid_request'},{status:400});
  if(action==='ai_begin'){
   if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'AI通話の接続設定が未完了です。'},{status:503});
   if(!VOICE_TOPICS.includes(data.topic)||!PRACTICE_LEVELS.includes(data.level??''))return NextResponse.json({error:'話題・レベルを確認してください。'},{status:400});
  }
  const {data:result,error}=await auth.rpcDb.rpc('practice_action',{p_action:action,p_data:data});
  if(error){const messages:Record<string,string>={human_match_already_active:'人とのマッチが先に成立しました。会話画面を確認してください。',consent_required:'音声の処理とログ保存について同意が必要です。',not_a_participant:'この通話を開く権限がありません。',no_transcript:'この通話の会話ログは取得できていません。'};return NextResponse.json({error:messages[error.message]||'操作を完了できませんでした。再試行してください。'},{status:error.message==='not_a_participant'?403:409});}
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'リクエストを確認してください。'},{status:400});}
}
