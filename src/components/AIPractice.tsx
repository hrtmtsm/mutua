'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {authorizedFetch,practiceAction,type VoiceSession} from '@/lib/practice';
import {usePracticeAudio} from '@/hooks/usePracticeAudio';
import {useLocale} from './LocaleProvider';
import {PrivacyLink} from './PrivacyNotice';
export default function AIPractice({available,onStarted,onEnded}:{available:boolean;onStarted:()=>void;onEnded:()=>void}){
 const {t}=useLocale();
 const [resume,setResume]=useState(false);
 const [usePracticeHistory, setUsePracticeHistory] = useState(false);
 const [session,setSession]=useState<VoiceSession|null>(null),[topic,setTopic]=useState('Casual conversation'),[level,setLevel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[enabled,setEnabled]=useState(false),[muted,setMuted]=useState(false);
 const audio=useRef<HTMLAudioElement>(null);const provider=usePracticeAudio(resume?session:null,null,muted,usePracticeHistory);
 useEffect(()=>{void authorizedFetch('/api/practice?capabilities').then(r=>r.json()).then(d=>setEnabled(!!d.ai)).catch(()=>{});void practiceAction<{voice:VoiceSession|null}>('state').then(d=>{if(d.voice?.partner_type==='ai')setSession(d.voice);}).catch(()=>{});},[]);
 useEffect(()=>{if(audio.current){audio.current.srcObject=provider.remote;if(provider.remote)void audio.current.play().catch(()=>setError(t('aiPractice.playAudioHint')));}},[provider.remote]);
 // Starting an AI session is itself the consent action — covered by the notice below, shown before the button.
 const start=async()=>{setBusy(true);setError('');try{const s=await practiceAction<VoiceSession>('ai_begin',{requestId:crypto.randomUUID(),topic,level,consent:true,consentVersion:'voice-log-v1'});setSession(s);setResume(true);onStarted();}catch(e){setError(e instanceof Error?e.message:t('liveExchange.connectFailed'));}finally{setBusy(false);}};
 const end=async()=>{if(!session)return;setBusy(true);try{await provider.finish();await practiceAction('end',{sessionId:session.id,reason:'hangup'});setSession({...session,status:'ended'});onEnded();}catch{setError(t('aiPractice.endSyncFailed'));}finally{setBusy(false);}};
 if(!available&&!session)return null;
 return <section className="live-card p-5" aria-label={t('aiPractice.sectionLabel')}>
 <audio ref={audio} autoPlay playsInline data-testid="ai-audio" data-connection-state={provider.status}/>
 <h2 className="font-bold text-balance pr-8">{session&&session.status!=='ended'?t('aiPractice.titleInCall'):t('aiPractice.titleOffer')}</h2>
 <p className="text-sm mt-2 text-pretty">{t('aiPractice.description')}</p>
 {(error||provider.error)&&<p role="alert" className="mt-2">{error||provider.error}</p>}
 {session&&session.status!=='ended'?<div className="mt-3 flex flex-wrap gap-3">{!resume&&<p>{t('aiPractice.otherTabNotice')}</p>}<p role="status">{provider.status==='connected'?t('app.callConnected'):provider.status==='ended'?t('aiPractice.connectionEnded'):t('aiPractice.connecting')}</p><button className="live-button-ghost" onClick={()=>setMuted(v=>!v)}>{muted?t('app.unmute'):t('app.mute')}</button><button className="live-button-ghost" onClick={()=>void audio.current?.play()}>{t('aiPractice.playAudio')}</button><button className="live-button" disabled={busy} onClick={end}>{t('aiPractice.endAiCall')}</button></div>:<>
 <details className="mt-4 text-sm">
  <summary className="cursor-pointer rounded-lg border border-current/10 px-3 py-2.5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{t('aiPractice.advancedSettings')}</summary>
  <div className="mt-3 grid gap-3 sm:grid-cols-2">
   <label className="min-w-0">
    <span className="lang-picker-label">{t('aiPractice.topicLabel')}</span>
    <select className="live-select w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" value={topic} onChange={event => setTopic(event.target.value)} disabled={busy}>
     <option>Casual conversation</option>
     <option>Travel</option>
     <option>Work</option>
     <option>Culture</option>
     <option>Daily life</option>
    </select>
   </label>
   <label className="min-w-0">
    <span className="lang-picker-label">{t('aiPractice.levelLabel')}</span>
    <select className="live-select w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" value={level} onChange={event => setLevel(event.target.value)} disabled={busy}>
     <option value="">{t('aiPractice.levelUnspecified')}</option>
     <option>Beginner</option>
     <option>Intermediate</option>
     <option>Advanced</option>
    </select>
   </label>
  </div>
 </details>
 <label className="mt-4 flex items-start gap-2 text-sm font-medium">
  <input className="mt-0.5" type="checkbox" checked={usePracticeHistory} disabled={busy} onChange={event => setUsePracticeHistory(event.target.checked)} />
  {t('aiPractice.personalize')}
 </label>
 <p className="live-note mt-2 text-pretty">
  {t('aiPractice.audioSummary')}{' '}
  <PrivacyLink section="ai-practice" label="privacy.details" />
 </p>
 <button className="live-button mt-4" disabled={busy||!enabled} onClick={start}>{enabled?t('aiPractice.startCallCta'):t('aiPractice.startCallPreparing')}</button>
 {session&&<Link className="ml-4 underline" href={`/calls/${session.id}`}>{t('aiPractice.openCallLog')}</Link>}
 </>}
 </section>;
}
