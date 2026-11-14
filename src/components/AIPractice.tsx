'use client';

import { DetailBackButton } from './DetailBackButton';
import { Button } from '@/components/ui/button';
import {useEffect,useRef,useState} from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useSpeaking } from '@/hooks/useSpeaking';
import {authorizedFetch,practiceAction,type VoiceSession} from '@/lib/practice';
import {usePracticeAudio} from '@/hooks/usePracticeAudio';
import {useLocale} from './LocaleProvider';
import { supabase } from '@/lib/supabase';
import { readCueSettings, type CueVoice } from '@/lib/cueSettings';
import {PrivacyLink} from './PrivacyNotice';
export default function AIPractice({session,onStarted,onEnded,callControls,callStatus,onSpeakingChange,backTarget,onBack}:{
 session: VoiceSession | null;
 backTarget?: HTMLElement | null;
 onBack?: () => void;
 onStarted: (session: VoiceSession) => void;
 onEnded: (sessionId: string) => void;
 callControls: HTMLDivElement | null;
 callStatus: HTMLDivElement | null;
 onSpeakingChange: (speaking: boolean) => void;
}){
 const {t}=useLocale();
 const [resume,setResume]=useState(false);
 const [voice, setVoice] = useState<CueVoice>('random');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[enabled,setEnabled]=useState(false),[muted,setMuted]=useState(false);
 const audio=useRef<HTMLAudioElement>(null);const provider=usePracticeAudio(resume?session:null,null,muted,true,false,voice);
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
   const { data, error: authError } = await supabase.auth.getUser();
   if (authError) throw authError;
   const { topic, level, voice } = readCueSettings(data.user?.user_metadata.cue_settings);
   setVoice(voice);
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
 const end = async (exitRoom = false) => {
  if (!session) return;
  setBusy(true);
  try {
   await provider.finish();
   await practiceAction('end', { sessionId: session.id, reason: 'hangup' });
   onEnded(session.id);
   if (exitRoom) onBack?.();
  } catch {
   setError(t('aiPractice.endSyncFailed'));
  } finally {
   setBusy(false);
  }
 };
 const content = <section className={callControls ? "text-sm" : "live-card p-5"} aria-label={t('aiPractice.sectionLabel')}>
 <audio ref={audio} autoPlay playsInline data-testid="ai-audio" data-connection-state={provider.status}/>
 {!session && (
   <div className="flex flex-col items-center gap-3 pt-3 text-center">
    <div className="cue-modal-mascot size-36 shrink-0 overflow-hidden">
     <div className="ai-cloud-avatar ai-cloud-avatar--plain" aria-hidden="true" />
    </div>
    <style jsx>{`
     @media (prefers-reduced-motion: no-preference) {
      .cue-modal-mascot { animation: cue-pop 200ms ease-out both; }
     }
     @keyframes cue-pop {
      0% { opacity: 0; transform: translateY(8px) scale(.88); }
      70% { opacity: 1; transform: translateY(-3px) scale(1.04); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
     }
    `}</style>
    <h2 className="text-2xl font-bold text-balance">{t('aiPractice.titleOffer')}</h2>
    <p className="max-w-sm text-sm leading-relaxed text-pretty">{t('aiPractice.description')}</p>
   </div>
  )}
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
   <Button type="button" className="live-button live-button-danger" disabled={busy} onClick={() => void end(true)}>{t('liveExchange.leaveLabel')}</Button>
  </div>
 ) :<>
 <Button className="live-button mt-5 w-full justify-center" disabled={busy||!enabled} onClick={start}>{enabled?t('aiPractice.startCallCta'):t('aiPractice.startCallPreparing')}</Button>
 <p className="live-note mt-2 text-center text-pretty">
  {t('aiPractice.audioSummary')}{' '}
  <PrivacyLink section="ai-practice" label="privacy.details" />
 </p>

 </>}
 </section>;
 return <>
  {callControls ? createPortal(content, callControls) : content}
  {backTarget && createPortal(
   <DetailBackButton label={t('nav.exchange')} disabled={busy} onClick={() => void end(true)} />,
   backTarget,
  )}
 </>;
}
