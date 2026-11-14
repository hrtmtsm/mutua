import {supabase} from './supabase';
export type VoiceSession={id:string;call_id:string|null;conversation_id:string|null;user_a:string;user_b:string|null;partner_type:'human'|'ai';native_language_a:string;learning_language_a:string;native_language_b:string|null;learning_language_b:string|null;topic:string;practice_level:string|null;status:'starting'|'active'|'ended';started_at:string|null;ended_at:string|null;duration_secs:number;ended_reason:string|null;transcript_status:'pending'|'collecting'|'ready'|'partial'|'disabled';consent_version:string|null;created_at:string};
export type Utterance={id:string;session_id:string;speaker_id:string;speaker_role:'human'|'assistant';provider_item_id:string;sequence:number;offset_ms:number|null;body:string;final:boolean;created_at:string};
export type ReviewMessage={id:string;request_id:string;role:'user'|'assistant';body:string;quoted_utterance_ids:string[];status:'pending'|'completed'|'failed';error_code:string|null;created_at:string};
export type PracticeDetail={session:VoiceSession;utterances:Utterance[];thread:string|null;reflection:ReviewMessage[]};
export async function authorizedFetch(path:string,init:RequestInit={}){
 let {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('ログインしてください。');
 const send=(token:string)=>fetch(path,{...init,signal:init.signal||AbortSignal.timeout(20000),headers:{...init.headers,Authorization:`Bearer ${token}`}});
 let response=await send(session.access_token);
 if(response.status===401){const refreshed=await supabase.auth.refreshSession();if(!refreshed.data.session)throw Error('もう一度ログインしてください。');response=await send(refreshed.data.session.access_token);}
 return response;
}
export async function practiceAction<T=VoiceSession>(action:string,data:Record<string,unknown>={}):Promise<T>{
 const response=await authorizedFetch('/api/practice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'操作を完了できませんでした。');return result;
}

const detailRequests = new Map<string, Promise<PracticeDetail>>();

export function loadPracticeDetail(sessionId: string, accessToken: string, refresh = false) {
 const key = `${accessToken}:${sessionId}`;
 const existing = detailRequests.get(key);
 if (existing && !refresh) return existing;

 const request = fetchPracticeHistory<PracticeDetail>(sessionId);
 detailRequests.set(key, request);
 const clear = () => {
  if (detailRequests.get(key) === request) detailRequests.delete(key);
 };
 void request.then(() => setTimeout(clear, 5000), clear);
 return request;
}

export async function fetchPracticeHistory<T>(sessionId: string, chat = false, signal?: AbortSignal): Promise<T> {
 const params = new URLSearchParams({call: sessionId});
 if (chat) params.set('chat', '1');
 const response = await authorizedFetch('/api/practice?' + params, {signal});
 const data = await response.json();
 if (!response.ok) throw new Error(data.error || '履歴を読み込めませんでした。');
 return data;
}
