'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {authorizedFetch,practiceAction,type VoiceSession} from '@/lib/practice';
import {useLocale} from '@/components/LocaleProvider';

/** One provider connection per local participant. Original audio is never persisted. */
export function usePracticeAudio(session:VoiceSession|null, source:MediaStream|null, muted:boolean, usePracticeHistory = false){
 const {t}=useLocale();
 const [diagnostics,setDiagnostics]=useState({events:'',sentBytes:0,commits:0});
 const [status,setStatus]=useState('idle');const [error,setError]=useState('');const [remote,setRemote]=useState<MediaStream|null>(null);
 const stopRef=useRef<()=>Promise<void>>(async()=>{});const mutedRef=useRef(muted);mutedRef.current=muted;
 const tracksRef=useRef<MediaStream|null>(null);
 useEffect(()=>{tracksRef.current?.getAudioTracks().forEach(t=>t.enabled=!muted);},[muted]);
 const id=session?.id;const kind=session?.partner_type==='ai'?'ai':'transcription';
 const enabled=!!session&&session.status!=='ended'&&!!session.consent_version&&(kind==='ai'||(session.status==='active'&&!!source));
 useEffect(()=>{
  if(!id||!enabled)return;
  let cancelled=false,closing=false,connectionId:string|undefined,stream:MediaStream|undefined,pc:RTCPeerConnection|undefined,dc:RTCDataChannel|undefined;
  let timer:ReturnType<typeof setInterval>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
  const pending=new Set<Promise<unknown>>(),unfinished=new Set<string>(),done=new Set<string>();const items=new Map<string,{sequence:number;offsetMs:number}>();let sequence=0,partial=false;
  const eventTypes=new Set<string>();let commits=0;
  const providerStart=Date.now();const start=session?.started_at?Date.parse(session.started_at):providerStart;let commitAt=Date.now();let finishPromise:Promise<void>|undefined;
  setStatus('connecting');setError('');setRemote(null);
  const item=(key:string)=>{if(!items.has(key))items.set(key,{sequence:sequence++,offsetMs:Date.now()-start});return items.get(key)!;};
  const send=(event:Record<string,unknown>)=>{if(dc?.readyState==='open'){dc.send(JSON.stringify(event));if(event.type==='input_audio_buffer.commit')commits++;}};
  const save=(event:Record<string,unknown>)=>{const p=practiceAction('utterance',{sessionId:id,...event}).catch(()=>{partial=true;setError(t('practiceAudio.saveUtteranceFailed'));}).finally(()=>pending.delete(p));pending.add(p);};
  const closeProvider=async()=>{if(!connectionId)return;try{const r=await authorizedFetch('/api/practice/provider',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'close',connectionId})});if(!r.ok)throw Error();}catch{setError(t('practiceAudio.closeConfirmFailed'));}};
  const finish=()=>{
   if(finishPromise)return finishPromise;
   finishPromise=(async()=>{
    closing=true;clearInterval(timer);clearInterval(heartbeat);clearTimeout(deadline);
    stream?.getTracks().forEach(t=>t.stop());tracksRef.current=null;
    if(dc?.readyState==='open'&&kind==='transcription')send({type:'input_audio_buffer.commit'});
    const until=Date.now()+4500;
    // Final recognition may arrive after the microphone stops. Keep the channel
    // open briefly and persist only final items; never invent missing speech.
    await new Promise(r=>setTimeout(r,600));
    while((unfinished.size||pending.size)&&Date.now()<until)await new Promise(r=>setTimeout(r,100));
    if(unfinished.size||pending.size)partial=true;
    await Promise.allSettled([...pending]);
    await practiceAction('transcript_status',{sessionId:id,status:partial?'partial':'ready'}).catch(()=>{});
    dc?.close();pc?.close();setRemote(null);await closeProvider();if(kind==='ai')await practiceAction('end',{sessionId:id,reason:partial?'provider_failure':'hangup'}).catch(()=>{});setStatus('ended');
   })();return finishPromise;
  };stopRef.current=finish;
  const fail=async(message:string)=>{if(closing||cancelled)return;partial=true;setError(message);await finish();if(kind==='ai')await practiceAction('end',{sessionId:id,reason:'provider_failure'}).catch(()=>{});};
  const onMessage=(message:MessageEvent)=>{
   let e:any;try{e=JSON.parse(message.data);}catch{return;}
   if(e.type)eventTypes.add(e.type);setDiagnostics(d=>({...d,events:[...eventTypes].join(','),commits}));
   const key=e.item_id||e.item?.id;
   if(e.type==='input_audio_buffer.speech_started'&&key){const current=item(key);current.offsetMs=Math.max(0,providerStart-start+(e.audio_start_ms||0));unfinished.add(key);}
   if(e.type==='input_audio_buffer.committed'&&key){item(key);unfinished.add(key);}
   if(e.type==='response.output_item.added'&&e.item?.role==='assistant'&&key){item(key);unfinished.add(key);}
   if(e.type==='conversation.item.input_audio_transcription.completed'&&key){
    unfinished.delete(key);if(!done.has(key)){done.add(key);if(e.transcript?.trim())save({itemId:key,role:'human',body:e.transcript,...item(key),final:true});}
   }
   if(['response.output_audio_transcript.done','response.audio_transcript.done'].includes(e.type)&&key){
    unfinished.delete(key);if(!done.has(key)){done.add(key);if(e.transcript?.trim())save({itemId:key,role:'assistant',body:e.transcript,...item(key),final:true});}
   }
   if(e.type==='conversation.item.input_audio_transcription.failed'){unfinished.delete(key);partial=true;setError(t('practiceAudio.transcriptionPartialFailed'));}
   if(e.type==='error'&&e.error?.code!=='input_audio_buffer_commit_empty')void fail(t('practiceAudio.processingFailed'));
  };
  deadline=setTimeout(()=>void fail(t('practiceAudio.micOrAudioTimeout')),25000);
  void(async()=>{
   try{
    stream=source?new MediaStream(source.getAudioTracks().map(t=>t.clone())):await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    if(cancelled||closing){stream.getTracks().forEach(t=>t.stop());return;}
    tracksRef.current=stream;stream.getAudioTracks().forEach(t=>t.enabled=!mutedRef.current);
    pc=new RTCPeerConnection();stream.getTracks().forEach(t=>pc!.addTrack(t,stream!));
    pc.ontrack=e=>{if(!cancelled&&kind==='ai')setRemote(e.streams[0]||new MediaStream([e.track]));};
    pc.onconnectionstatechange=()=>{
     if(pc?.connectionState==='connected'){clearTimeout(deadline);setStatus('connected');if(kind==='ai')void practiceAction('connected',{sessionId:id}).catch(()=>fail(t('practiceAudio.recordStartFailed')));}
     if(pc?.connectionState==='failed')void fail(t('practiceAudio.connectionLost'));
    };
    dc=pc.createDataChannel('oai-events');dc.onmessage=onMessage;
    dc.onopen=()=>{if(kind==='ai')send({type:'response.create'});};
    dc.onclose=()=>{if(!closing&&!cancelled)void fail(t('practiceAudio.processingConnectionLost'));};
    await pc.setLocalDescription(await pc.createOffer());
    const response=await authorizedFetch('/api/practice/provider',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,sessionId:id,sdp:pc.localDescription?.sdp,usePracticeHistory}),signal:AbortSignal.timeout(25000)});
    const answer=await response.json();if(!response.ok)throw Error(answer.error||t('practiceAudio.startFailed'));connectionId=answer.connectionId;
    if(cancelled||closing){await closeProvider();return;}
    await pc.setRemoteDescription({type:'answer',sdp:answer.sdp});
    if(kind==='transcription'&&answer.manualCommit)timer=setInterval(()=>{if(Date.now()-commitAt>7000){send({type:'input_audio_buffer.commit'});commitAt=Date.now();}},8000);
    heartbeat=setInterval(()=>{void pc?.getStats().then(report=>{let sentBytes=0;report.forEach(row=>{if(row.type==='outbound-rtp'&&row.kind==='audio')sentBytes+=row.bytesSent||0;});setDiagnostics({events:[...eventTypes].join(','),sentBytes,commits});});void practiceAction('heartbeat',{sessionId:id}).then((s:any)=>{if(s.status==='ended')void finish();}).catch(()=>{});},10000);
    clearTimeout(deadline);deadline=setTimeout(()=>void fail(t('practiceAudio.connectTimeout')),25000);
   }catch(e){if(!cancelled)await fail(e instanceof DOMException&&e.name==='NotAllowedError'?t('practiceAudio.micDenied'):e instanceof Error?e.message:t('practiceAudio.connectFailed'));}
  })();
  return ()=>{cancelled=true;void finish();};
 },[id,enabled,source,kind,usePracticeHistory]);
 const finish=useCallback(()=>stopRef.current(),[]);
 return {status,error,remote,finish,diagnostics};
}
