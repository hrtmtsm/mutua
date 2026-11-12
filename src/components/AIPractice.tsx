'use client';
import {useEffect,useRef,useState} from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useSpeaking } from '@/hooks/useSpeaking';
import {authorizedFetch,practiceAction,type VoiceSession} from '@/lib/practice';
import {usePracticeAudio} from '@/hooks/usePracticeAudio';
import {useLocale} from './LocaleProvider';
import {PrivacyLink} from './PrivacyNotice';
export default function AIPractice({session,onStarted,onEnded,callControls,callStatus,onSpeakingChange}:{
 session: VoiceSession | null;
 onStarted: (session: VoiceSession) => void;
 onEnded: (sessionId: string) => void;
 callControls: HTMLDivElement | null;
 callStatus: HTMLDivElement | null;
 onSpeakingChange: (speaking: boolean) => void;
}){
 const {t}=useLocale();
 const [resume,setResume]=useState(false);
 const [usePracticeHistory, setUsePracticeHistory] = useState(false);
 const [topic,setTopic]=useState('Casual conversation'),[level,setLevel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[enabled,setEnabled]=useState(false),[muted,setMuted]=useState(false);
 const audio=useRef<HTMLAudioElement>(null);const provider=usePracticeAudio(resume?session:null,null,muted,usePracticeHistory);
 const speaking = useSpeaking(provider.remote);
 useEffect(() => { onSpeakingChange(speaking); }, [speaking, onSpeakingChange]);
 useEffect(()=>{void authorizedFetch('/api/practice?capabilities').then(r=>r.json()).then(d=>setEnabled(!!d.ai)).catch(()=>{});},[]);
 useEffect(()=>{if(audio.current){audio.current.srcObject=provider.remote;if(provider.remote)void audio.current.play().catch(()=>setError(t('aiPractice.playAudioHint')));}},[provider.remote,callControls]);
 // Starting an AI session is itself the consent action — covered by the notice below, shown before the button.
 const start = async () => {
  setBusy(true);
  setError('');
  const requestId = crypto.randomUUID();
  try {
   const next = await practiceAction<VoiceSession & { request_id: string | null }>('ai_begin', {
    requestId, topic, level, consent: true, consentVersion: 'voice-log-v1',
   });
   setResume(next.request_id === requestId);
   onStarted(next);
  } catch (error) {
   setError(error instanceof Error ? error.message : t('liveExchange.connectFailed'));
  } finally {
   setBusy(false);
  }
 };
 const end = async () => {
  if (!session) return;
  setBusy(true);
  try {
   await provider.finish();
   await practiceAction('end', { sessionId: session.id, reason: 'hangup' });
   onEnded(session.id);
  } catch {
   setError(t('aiPractice.endSyncFailed'));
  } finally {
   setBusy(false);
  }
 };
 const content = <section className={callControls ? "text-sm" : "live-card p-5"} aria-label={t('aiPractice.sectionLabel')}>
 <audio ref={audio} autoPlay playsInline data-testid="ai-audio" data-connection-state={provider.status}/>
 {!session && <h2 className="font-bold text-balance pr-8">{t('aiPractice.titleOffer')}</h2>}
 {!callControls && <p className="text-sm mt-2 text-pretty">{t('aiPractice.description')}</p>}
 {(error||provider.error)&&<p role="alert" className="mt-2">{error||provider.error}</p>}
 {session && session.status !== 'ended' ? (
  <div className="flex flex-wrap items-center justify-center gap-2">
   {!resume && <p className="basis-full">{t('aiPractice.otherTabNotice')}</p>}
   {callStatus && createPortal(
    <span role="status">{provider.status === 'connected' ? t('app.callConnected') : provider.status === 'ended' ? t('aiPractice.connectionEnded') : t('aiPractice.connecting')}</span>,
    callStatus,
   )}
   <button type="button" className="live-icon-btn" aria-pressed={muted} aria-label={t(muted ? 'app.unmute' : 'app.mute')} title={t(muted ? 'app.unmute' : 'app.mute')} onClick={() => setMuted(value => !value)}>
    {muted ? <MicOff className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
   </button>
   <button type="button" className="live-icon-btn" aria-label={t('aiPractice.playAudio')} title={t('aiPractice.playAudio')} onClick={() => void audio.current?.play()}>
    <Volume2 className="size-5" aria-hidden="true" />
   </button>
   <button type="button" className="live-button live-button-danger" disabled={busy} onClick={end}>{t('aiPractice.endAiCall')}</button>
  </div>
 ) :<>
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
 </>}
 </section>;
 return callControls ? createPortal(content, callControls) : content;
}
