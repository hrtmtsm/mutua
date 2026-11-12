'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import localFont from 'next/font/local';
import { supabase } from '@/lib/supabase';
import { liveAction, type LiveSnapshot, type LiveMessage } from '@/lib/liveExchange';
import { useLiveAudio } from '@/hooks/useLiveAudio';
import { useSpeaking } from '@/hooks/useSpeaking';
import AppShell from './AppShell';
import AIPractice from './AIPractice';
import {practiceAction} from '@/lib/practice';
import {usePracticeAudio} from '@/hooks/usePracticeAudio';
import SetupModal from './SetupModal';
import { PrivacyLink } from './PrivacyNotice';
import { initialsFor, isRealPhoto } from '@/lib/glyphAvatars';
import { LANG_AVATAR_COLOR, LANG_FLAG_CODE } from '@/lib/constants';
import { LANGUAGES, type Language } from '@/lib/types';
import LanguagePicker from './LanguagePicker';
import { Mic, MicOff, Phone, PhoneOff, SkipForward } from 'lucide-react';
import { useLocale } from './LocaleProvider';
import './liveExchange.css';

// Google Meet–style fallback: the real photo when there is one, otherwise
// initials on a language-colored background — never a stock cartoon glyph.
function AvatarTile({ url, name, color }: { url?: string | null; name?: string | null; color: string }) {
 return isRealPhoto(url)
  ? <img src={url} alt="" />
  : <div className="live-avatar-fallback" style={{ backgroundColor: color }}>{initialsFor(name) || '?'}</div>;
}

const liveFont = localFont({ src: '../app/preview/sky/fonts/Nunito-Variable.ttf', variable: '--font-live-logo', weight: '200 1000', display: 'swap' });

export default function LiveExchange() {
 const { t } = useLocale();
 const [user, setUser] = useState<User|null>(null);
 const [authLoaded, setAuthLoaded] = useState(false);
 const [profileReady, setProfileReady] = useState(false);
 const [profileLoaded, setProfileLoaded] = useState(false);
 const [pendingStart, setPendingStart] = useState(false);
 const startRead = useRef(false);
 const [setup, setSetup] = useState(false);
 const [setupInitialTab, setSetupInitialTab] = useState<'signup' | 'login'>('signup');
 const [mediaCallId,setMediaCallId]=useState<string|null>(null);
 const [snapshot, setSnapshot] = useState<LiveSnapshot|null>(null);
 const [messages, setMessages] = useState<LiveMessage[]>([]);
 const [input, setInput] = useState('');
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 const [sending, setSending] = useState(false);
 const [transcriptionConsentFor, setTranscriptionConsentFor] = useState<string | null>(null);
 const connectedCall=useRef('');
 const [muted, setMuted] = useState(false);
 const [audioBlocked, setAudioBlocked] = useState(false);
 const [expired, setExpired] = useState(false);
 const [showAiPrompt, setShowAiPrompt] = useState(false);
 const [aiStage, setAiStage] = useState<'ask' | 'practice'>('ask');
 const [stoppedByUser, setStoppedByUser] = useState(false);
 const [sessionId, setSessionId] = useState('');
 const [nativeLanguage, setNativeLanguage] = useState<Language | ''>('');
 const [learningLanguage, setLearningLanguage] = useState<Language | ''>('');
 const [myName, setMyName] = useState('');
 const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
 const audioRef = useRef<HTMLAudioElement>(null);
 const bottomRef = useRef<HTMLDivElement>(null);
 const currentRef = useRef<LiveSnapshot|null>(null);
 const requestVersion = useRef(0);
 const commandBusy = useRef(false);
 const pollBusy = useRef(false);
 const failedCall = useRef('');
 const sessionUser = useRef<string|null>(null);
 sessionUser.current = user?.id ?? null;
 const conversation = snapshot?.conversation;
 const active = conversation?.status === 'active';
 const call = active && snapshot?.call?.status === 'accepted' && mediaCallId===snapshot.call.id ? snapshot.call : null;
 const partner = snapshot?.partner;
 const loadProfile = useCallback(async (account: User) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('email', account.email!)
   .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (sessionUser.current !== account.id) return;
  if (error) { setError(t('liveExchange.profileLoadError')); return; }
  setProfileReady(!!data?.native_language && !!data?.learning_language);
  setProfileLoaded(true);
  if (data) {
   setSessionId(data.session_id);
   setNativeLanguage(data.native_language ?? '');
   setLearningLanguage(data.learning_language ?? '');
   setMyName(data.name ?? '');
   setMyAvatarUrl(data.avatar_url ?? null);
   localStorage.setItem('mutua_profile', JSON.stringify(data));
   localStorage.setItem('mutua_session_id', data.session_id);
   window.dispatchEvent(new Event('mutua:profile-updated'));
  }
 }, []);
 useEffect(() => {
  let alive = true;
  supabase.auth.getSession().then(({ data }) => {
   if (alive) { setUser(data.session?.user ?? null); setAuthLoaded(true); }
  });
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
   setUser(session?.user ?? null); setAuthLoaded(true);
  });
  return () => { alive = false; data.subscription.unsubscribe(); };
 }, []);
 useEffect(() => {
  setProfileReady(false); setProfileLoaded(false); setSnapshot(null); setMessages([]); currentRef.current = null;
  setSessionId(''); setNativeLanguage(''); setLearningLanguage(''); setMyName(''); setMyAvatarUrl(null);
  requestVersion.current++;
  if (user) loadProfile(user);
 }, [user?.id, loadProfile]);
 const apply = useCallback((next: LiveSnapshot) => {
  const previous = currentRef.current;
  if (previous?.queue && !next.queue && !next.conversation) { setExpired(true); setAiStage('ask'); setShowAiPrompt(true); }
  if (previous?.conversation?.id !== next.conversation?.id) setMessages(next.messages || []);
  else setMessages(old => {
   const merged = new Map(old.map(message => [message.id, message]));
   (next.messages || []).forEach(message => merged.set(message.id, message));
   return [...merged.values()].sort((a,b) => a.id-b.id);
  });
  currentRef.current = next; setSnapshot(next);
 }, []);
 const refresh = useCallback(async () => {
  if (pollBusy.current || commandBusy.current) return;
  pollBusy.current = true;
  const version = requestVersion.current;
  const identity = sessionUser.current;
  try {
   const next = await liveAction('state');
   if (version === requestVersion.current && identity === sessionUser.current) apply(next);
  } catch (error) { if (identity === sessionUser.current) setError(error instanceof Error ? error.message : t('liveExchange.connectionError')); }
  finally { pollBusy.current = false; }
 }, [apply]);
 useEffect(() => {
  if (!user || !profileReady) return;
  refresh();
  const interval = setInterval(refresh, 2000);
  const onFocus = () => refresh();
  window.addEventListener('focus', onFocus);
  return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
 }, [user?.id, profileReady, refresh]);
 useEffect(() => {
  if (!conversation?.id || !user) return;
  const channel = supabase.channel(`live:${conversation.id}:${user.id}`);
  for (const table of ['live_messages','live_calls']) channel.on('postgres_changes',
   { event: '*', schema: 'public', table, filter: `conversation_id=eq.${conversation.id}` }, refresh);
  channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_conversations', filter: `id=eq.${conversation.id}` }, refresh).subscribe();
  return () => { supabase.removeChannel(channel); };
 }, [conversation?.id, user?.id, refresh]);
 const command = async (action: string, data: Record<string, unknown> = {}) => {
  if (commandBusy.current) throw new Error(t('liveExchange.actionBusyError'));
  commandBusy.current = true; const version = ++requestVersion.current;
  const identity = sessionUser.current;
  try {
   const next = await liveAction(action, data);
   if((action==='invite'||action==='accept')&&next.call?.id)setMediaCallId(next.call.id);
   if (version === requestVersion.current && identity === sessionUser.current) apply(next);
   return next;
  } finally { commandBusy.current = false; }
 };
 const perform = async (action: string, data: Record<string, unknown> = {}) => {
  setError(''); setBusy(true);
  try { await command(action, data); }
  catch (error) { setError(error instanceof Error ? error.message : t('liveExchange.actionFailed')); }
  finally { setBusy(false); }
 };
 const stopFailedCall = (reason: string) => {
  if (!call || failedCall.current === call.id) return;
  failedCall.current = call.id;
  setError(reason);
  const failedCallId = call.id;
  liveAction('end_call', { conversationId: call.conversation_id, callId: failedCallId, reason: 'media_failure' })
   .then(next => { if (currentRef.current?.call?.id === failedCallId) { requestVersion.current++; apply(next); } })
   .catch(() => { if (currentRef.current?.call?.id === failedCallId) setError(`${reason} ${t('liveExchange.callEndSyncFailed')}`); });
 };
 const rtc = useLiveAudio({ callId: call?.id, conversationId: call?.conversation_id,
  myId: user?.id, partnerId: partner?.id, muted, onFailure: stopFailedCall });
 const selfSpeaking = useSpeaking(rtc.local) && !muted;
 const partnerSpeaking = useSpeaking(rtc.remote);
 const transcription=usePracticeAudio(snapshot?.voice?.partner_type==='human'?snapshot.voice:null,rtc.local,muted);
 useEffect(()=>{
  if(rtc.state!=='connected'||!call||connectedCall.current===call.id)return;
  connectedCall.current=call.id;
  void practiceAction('connected',{callId:call.id}).then(()=>refresh()).catch(()=>{connectedCall.current='';setError(t('liveExchange.callLogStartFailed'));});
 },[rtc.state,call?.id,refresh]);
 const endVoice=async()=>{setBusy(true);rtc.local?.getTracks().forEach(t=>t.stop());await transcription.finish();await perform('end_call',{conversationId:conversation?.id,callId:call?.id});};
 useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;
  audio.srcObject = rtc.remote;
  setAudioBlocked(false);
  if (rtc.remote) audio.play().catch(() => setAudioBlocked(true));
 }, [rtc.remote]);
 useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
 // Every match starts as text — voice is never a separate queue to choose,
 // just an "通話を開始" button inside the conversation once matched.
 const join = async (native = nativeLanguage, learning = learningLanguage) => {
  if (!authLoaded) return;
  if (!user || !profileReady) { setPendingStart(true); setSetupInitialTab('signup'); setSetup(true); return; }
  setExpired(false); setShowAiPrompt(false);
  setError(''); setBusy(true);
  try {
   const current = await command('state');
   if (current.conversation?.status !== 'active') await command('join', { kind: 'text', nativeLanguage: native, learningLanguage: learning });
  } catch (error) { setError(error instanceof Error ? error.message : t('liveExchange.connectFailed')); }
  finally { setBusy(false); }
 };
 // Only a link from the landing page's own CTA (?start=) skips straight to
 // searching — a bare /app visit always shows the preview + Start screen
 // first, so arriving here is never mistaken for already being "Next"ed.
 // ?native=/?learning= carry over a language pair the person already chose
 // on the landing page, so it doesn't need to be picked twice.
 useEffect(() => {
  if (!authLoaded || (user && !profileLoaded) || startRead.current) return;
  startRead.current = true;
  const params = new URLSearchParams(window.location.search);
  const requestedNative = params.get('native');
  const requestedLearning = params.get('learning');
  if (requestedNative && (LANGUAGES as readonly string[]).includes(requestedNative)) setNativeLanguage(requestedNative as Language);
  if (requestedLearning && (LANGUAGES as readonly string[]).includes(requestedLearning)) setLearningLanguage(requestedLearning as Language);
  const hasStart = params.has('start');
  // A dedicated "already have an account? log in" entry point — opens
  // straight to the login tab and never auto-joins a search afterward
  // (that's decided by onComplete's isSignup flag, not by this param).
  const hasLogin = params.has('login');
  if (hasStart || hasLogin || requestedNative || requestedLearning) {
   params.delete('start'); params.delete('login'); params.delete('native'); params.delete('learning');
   window.history.replaceState(null, '', window.location.pathname + (params.size ? `?${params}` : '') + window.location.hash);
  }
  if (hasLogin && !user) { setSetupInitialTab('login'); setSetup(true); }
  // Pass the URL-derived values straight through instead of reading
  // nativeLanguage/learningLanguage state here — the setState calls above
  // haven't committed yet within this same effect, so the state would
  // still read as whatever it was before this effect ran.
  // Only auto-join when there's still a signup step to show first — an
  // already-set-up visitor lands on the normal Start screen instead of
  // being dropped straight into a call.
  if (hasStart && !(user && profileReady)) void startWith(
   requestedNative && (LANGUAGES as readonly string[]).includes(requestedNative) ? requestedNative as Language : null,
   requestedLearning && (LANGUAGES as readonly string[]).includes(requestedLearning) ? requestedLearning as Language : null,
  );
 }, [authLoaded, user?.id, profileLoaded]);
 useEffect(() => {
  if (!pendingStart || setup || !user || !profileReady) return;
  setPendingStart(false); void join();
 }, [pendingStart, setup, user?.id, profileReady]);
 // Start: the explicit entry point (preview screen's button, or the landing
 // page's ?native=/?learning=) — saves any condition change first (when
 // there's a profile to save it to), and only then joins. Takes explicit
 // overrides rather than always reading nativeLanguage/learningLanguage
 // state; the server persists the pair inside the same matching transaction, so a value from URL params is never skipped
 // while waiting for its own setState to commit.
 const startWith = async (overrideNative: Language | null, overrideLearning: Language | null) => {
  const native = overrideNative ?? nativeLanguage;
  const learning = overrideLearning ?? learningLanguage;
  if (user && profileReady && native && learning) {
   if (native === learning) { setError(t('liveExchange.sameLanguageError')); return; }
  }
  setStoppedByUser(false);
  await join(native, learning);
 };
 const handleStart = () => startWith(null, null);
 // Next: skip whatever's happening now (if anything) and look for someone new.
 const handleNext = async () => {
  if (!authLoaded) return;
  setStoppedByUser(false);
  setError(''); setBusy(true);
  try {
   await transcription.finish();
   const existing = currentRef.current;
   if (existing?.conversation?.status === 'active') await command('end', { conversationId: existing.conversation.id, callId: existing.call?.id });
   else if (existing?.queue) await command('cancel');
   if (!user || !profileReady) { setPendingStart(true); setSetupInitialTab('signup'); setSetup(true); return; }
   setExpired(false); setShowAiPrompt(false);
   await command('join', { kind: 'text', nativeLanguage, learningLanguage });
  } catch (error) { setError(error instanceof Error ? error.message : t('liveExchange.connectFailed')); }
  finally { setBusy(false); }
 };
 // Stop: end/cancel whatever's happening and stay paused until Next is pressed again.
 const handleStop = async () => {
  setStoppedByUser(true);
  setError(''); setBusy(true);
  try {
   await transcription.finish();
   const existing = currentRef.current;
   if (existing?.conversation?.status === 'active') await command('end', { conversationId: existing.conversation.id, callId: existing.call?.id });
   else if (existing?.queue) await command('cancel');
  } catch (error) { setError(error instanceof Error ? error.message : t('liveExchange.actionFailed')); }
  finally { setBusy(false); }
 };
 const sendMessage = async (event: React.FormEvent) => {
  event.preventDefault();
  if (!input.trim() || !conversation || sending) return;
  const text = input.trim();
  setSending(true); setError('');
  try {
   await command('message', { conversationId: conversation.id, body: text, clientId: crypto.randomUUID() });
   setInput(value => value === input ? '' : value);
  } catch (error) { setError(error instanceof Error ? error.message : t('liveExchange.sendMessageFailed')); }
  finally { setSending(false); }
 };
 const actionData = { conversationId: conversation?.id, callId: snapshot?.call?.id };
 const incomingInvite = snapshot?.call?.status === 'ringing' && snapshot.call.from_user !== user?.id;
 const canInvite = !snapshot?.call || ['expired', 'declined', 'cancelled', 'ended'].includes(snapshot.call.status);
 const consentKey = incomingInvite
  ? snapshot.call?.id
  : conversation && `${conversation.id}:${snapshot?.call?.id ?? 'first'}:${snapshot?.call?.status ?? 'idle'}`;
 const transcriptionConsent = !!consentKey && transcriptionConsentFor === consentKey;
 const respondToCall = (action: 'invite' | 'accept' | 'decline') => {
  setTranscriptionConsentFor(null);
  void perform(action, action === 'decline' ? actionData : { ...actionData, transcriptionConsent });
 };
 return <div className={liveFont.variable}>
  <AppShell>
  <main className="flex-1 flex flex-col min-h-[640px] md:min-h-[calc(100vh-56px)]">
   <div className="live-exchange-scene flex-1 p-4 md:py-6 md:px-6">
    <div className="live-content">
    <audio ref={audioRef} autoPlay playsInline data-testid="remote-audio" data-connection-state={rtc.state} data-sent-bytes={rtc.stats.sentBytes} data-received-bytes={rtc.stats.receivedBytes} data-received-energy={rtc.stats.receivedEnergy} />
    {error && <div role="alert" className="live-error mb-4">{error}</div>}
    <div className="live-stage">
     {active ? (
      <div className="live-split">
       <div className="live-call-column">
       <div className="live-video-row">
        <div className="live-main-tile" data-speaking={call && partnerSpeaking ? 'true' : undefined}>
         <div className="live-partner-badge">
          {partner?.nativeLanguage && LANG_FLAG_CODE[partner.nativeLanguage] && <span className={`fi fi-${LANG_FLAG_CODE[partner.nativeLanguage]}`} aria-hidden="true" />}
          <span className="live-partner-badge-name">{partner?.name || t('liveExchange.partnerFallbackName')}</span>
          {partner?.nativeLanguage && <span className="live-partner-badge-native">{partner.nativeLanguage} · {t('partnerProfile.nativeSuffix')}</span>}
         </div>
         <span className="live-avatar-hero"><AvatarTile url={partner?.avatarUrl} name={partner?.name} color={LANG_AVATAR_COLOR[partner?.nativeLanguage ?? ''] ?? '#171717'} /></span>
         <div className="live-pip-self" data-speaking={call && selfSpeaking ? 'true' : undefined}>
          <AvatarTile url={myAvatarUrl} name={myName} color={LANG_AVATAR_COLOR[nativeLanguage] ?? '#171717'} />
         </div>
        </div>
       </div>
       <section className="live-card live-call-controls">
        <p className="live-pill-status">{partner?.nativeLanguage} → {partner?.learningLanguage}</p>
        {(canInvite || incomingInvite) && (
         <div className="mt-2 max-w-md space-y-1 text-center">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
           <input
            type="checkbox"
            checked={transcriptionConsent}
            disabled={busy}
            aria-describedby="call-transcription-summary"
            onChange={e => setTranscriptionConsentFor(e.target.checked ? consentKey ?? null : null)}
           />
           {t('privacy.transcriptionOption')}
          </label>
          <p id="call-transcription-summary" className="live-note text-pretty">
           {t('privacy.transcriptionSummary')}{' '}
           <PrivacyLink section="call-transcription" label="privacy.details" />
          </p>
         </div>
        )}
        {canInvite && (
         <button disabled={busy} onClick={() => respondToCall('invite')} className="live-button">📞 {t('app.startCall')}</button>
        )}
        {snapshot?.call?.status==='accepted'&&!call&&<button className="live-button" onClick={()=>setMediaCallId(snapshot.call!.id)}>{t('liveExchange.joinCallThisTab')}</button>}
        {snapshot?.call?.status === 'ringing' && <>
         <p role="status" className="live-pill-status">{snapshot.call.from_user === user?.id ? t('app.waitingForAnswer') : t('app.callInvite')}</p>
         {snapshot.call.from_user === user?.id
          ? <button disabled={busy} onClick={() => perform('cancel_invite', actionData)} className="live-button-ghost">{t('app.cancelInvite')}</button>
          : <div className="flex gap-2"><button disabled={busy} onClick={() => respondToCall('accept')} className="live-button">{t('app.accept')}</button><button disabled={busy} onClick={() => respondToCall('decline')} className="live-button-ghost">{t('app.decline')}</button></div>}
        </>}
        {call && <>
         <p role="status" className="live-pill-status">{rtc.state === 'connected' ? t('app.callConnected') : rtc.state === 'failed' ? t('app.callFailed') : t('app.callConnecting')}</p>
         <div className="flex gap-2">
          <button aria-pressed={muted} aria-label={muted ? t('app.unmute') : t('app.mute')} title={muted ? t('app.unmute') : t('app.mute')} onClick={() => setMuted(value => !value)} className="live-icon-btn">{muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
          <button disabled={busy} aria-label={t('app.endCall')} title={t('app.endCall')} onClick={endVoice} className="live-icon-btn live-icon-btn-danger"><PhoneOff className="w-5 h-5" /></button>
         </div>
        </>}
        {call && snapshot?.voice?.consent_version && (
         <p role="status" className="live-pill-status" data-testid="transcription-status" data-status={transcription.status} data-events={transcription.diagnostics.events} data-sent-bytes={transcription.diagnostics.sentBytes} data-commits={transcription.diagnostics.commits}>
          {transcription.status === 'connected'
           ? t('privacy.transcribing')
           : !transcription.error && <>{t('liveExchange.transcriptionLogPrefix')} {transcription.status === 'ended' ? t('liveExchange.transcriptionEnded') : t('liveExchange.transcriptionPreparing')}</>}
         </p>
        )}
        {transcription.error&&<p role="alert" className="text-sm">{transcription.error}</p>}
        {snapshot?.voice&&<Link className="underline text-sm mt-3" href={`/calls/${snapshot.voice.id}`}>{t('liveExchange.callLogAiLink')}</Link>}
        {!call && snapshot?.call && ['expired','declined','cancelled','ended'].includes(snapshot.call.status) && <p role="status" className="live-pill-status">{({ expired:t('app.callExpired'), declined:t('app.callDeclined'), cancelled:t('app.callCancelled'), ended: snapshot.call.ended_reason === 'media_failure' ? t('app.callEndedMediaFailure') : t('app.callEnded') } as Record<string,string>)[snapshot.call.status]}</p>}
        {audioBlocked && <button onClick={() => audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setError(t('liveExchange.audioPlayFailed')))} className="live-button-ghost">{t('app.playRemoteAudio')}</button>}
       </section>
       </div>
       <section className="live-card live-chat-pane">
        <div role="log" aria-label={t('liveExchange.chatLogLabel')} aria-live="polite" className="flex-1 min-h-0 overflow-y-auto space-y-3">
         {messages.length === 0 && <p className="live-pill-status text-center">{t('app.matched')}</p>}
         {messages.map(message => <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
          <p className={`live-message ${message.sender_id === user?.id ? 'live-message-mine' : 'live-message-theirs'}`}>{message.body}</p>
         </div>)}<div ref={bottomRef} />
        </div>
        <form onSubmit={sendMessage} className="live-chat-input-bar">
         <input aria-label={t('liveExchange.messageInputLabel')} value={input} onChange={event => setInput(event.target.value)} maxLength={2000} placeholder={t('app.messagePlaceholder')} className="live-input" />
         <button disabled={sending || !input.trim() || busy} type="submit" className="live-button">{sending ? t('app.sending') : t('app.send')}</button>
        </form>
       </section>
      </div>
     ) : (
      <>
       {(stoppedByUser || (user && !profileReady) || conversation?.status === 'ended' || expired) && (
        <p className="live-pill-status text-center mb-3">
         {stoppedByUser ? t('app.stopped')
          : user && !profileReady ? t('app.needProfile')
          : expired ? t('app.expired')
          : conversation?.ended_reason === 'peer_left' ? t('app.peerLeft')
          : t('app.conversationEnded')}
        </p>
       )}
       <div className="live-split">
        <div className="live-call-column">
        <div className="live-video-row">
         <div className="live-main-tile">
          {snapshot?.queue ? (
           <>
            <div className="live-radar" role="status" aria-label={t('liveExchange.searchingLabel')}>
             <span className="live-avatar-hero"><AvatarTile url={myAvatarUrl} name={myName} color={LANG_AVATAR_COLOR[nativeLanguage] ?? '#171717'} /></span>
            </div>
            <p className="live-finding-text">{t('liveExchange.findingPartnerText')}</p>
            <span className="live-finding-dots" role="status"><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /></span>
           </>
          ) : (
           <>
            <span className="live-avatar-hero"><AvatarTile url={myAvatarUrl} name={myName} color={LANG_AVATAR_COLOR[nativeLanguage] ?? '#171717'} /></span>
            <p className="live-tile-empty-text">{t('app.notStarted')}</p>
           </>
          )}
         </div>
        </div>
        </div>
        <section className="live-card live-chat-pane">
         <div className="live-chat-pane-empty"><p className="live-pill-status">{snapshot?.queue ? t('app.waitingForPartner') : t('app.waitingForMatch')}</p></div>
        </section>
       </div>
       {!snapshot?.queue && (
        <div className="live-start-row">
         <button disabled={busy || !authLoaded} onClick={handleStart} className="live-button live-start-button"><Phone className="w-4 h-4" /> {t('app.startCall')}</button>
         {user && profileReady && (
          <div className="live-conditions" role="group" aria-label={t('liveExchange.conditionsLabel')}>
           <LanguagePicker value={nativeLanguage} onChange={setNativeLanguage} placeholder={t('app.nativePlaceholder')} label={t('setup.nativePlaceholder')} disabled={busy} />
           <LanguagePicker value={learningLanguage} onChange={setLearningLanguage} placeholder={t('app.learningPlaceholder')} label={t('setup.learningPlaceholder')} disabled={busy} />
          </div>
         )}
         {expired && user && <button onClick={() => { setAiStage('practice'); setShowAiPrompt(true); }} className="live-button-ghost">🤖 {t('liveExchange.practiceWithAi')}</button>}
        </div>
       )}
      </>
     )}
    </div>
    {active && <div className="live-control-bar">
     <button disabled={busy || !authLoaded} aria-label={t('liveExchange.nextPartnerLabel')} title={t('liveExchange.nextPartnerLabel')} onClick={handleNext} className="live-icon-btn"><SkipForward className="w-5 h-5" /></button>
     <button disabled={busy} aria-label={t('liveExchange.leaveLabel')} title={t('liveExchange.leaveLabel')} onClick={handleStop} className="live-icon-btn live-icon-btn-danger"><PhoneOff className="w-5 h-5" /></button>
    </div>}
    {!active && snapshot?.queue && <div className="live-control-bar">
     <button disabled={busy} onClick={handleStop} className="live-button live-start-button live-button-danger"><PhoneOff className="w-4 h-4" aria-hidden="true" /> {t('app.endCall')}</button>
    </div>}
    <p className="live-note shrink-0 text-center mt-3">{t('app.footnote')} <Link href="/profile">{t('app.profileLink')}</Link></p>
    </div>
   </div>
  </main>
  <SetupModal open={setup} onClose={() => { setSetup(false); setPendingStart(false); }} initialTab={setupInitialTab} onComplete={({ isSignup }) => {
   setSetup(false);
   // Returning users land on the home screen and press Start themselves —
   // only a fresh signup (a clear "start practicing now" intent) auto-joins.
   if (!isSignup) setPendingStart(false);
   supabase.auth.getSession().then(({data}) => { setUser(data.session?.user ?? null); if (data.session?.user) loadProfile(data.session.user); });
  }} initialNative={nativeLanguage || undefined} initialLearning={learningLanguage || undefined} />
  {showAiPrompt && user && (
   <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/40">
    {aiStage === 'ask' ? (
     <div className="live-modal-card w-full max-w-sm rounded-2xl shadow-2xl p-6 relative text-center space-y-4">
      <button onClick={() => setShowAiPrompt(false)} aria-label={t('setup.close')} className="absolute top-3 right-3 opacity-60 hover:opacity-100 text-sm w-7 h-7 flex items-center justify-center">✕</button>
      <p className="live-modal-title text-lg">{t('liveExchange.noPartnerFoundTitle')}</p>
      <p className="live-subtitle text-sm leading-relaxed">{t('liveExchange.noPartnerFoundBody')}</p>
      <div className="space-y-2">
       <button className="w-full live-button justify-center text-sm" onClick={() => setAiStage('practice')}>
        {t('liveExchange.practiceWithAi')}
       </button>
       <button className="w-full live-button-ghost justify-center text-sm" onClick={() => { setShowAiPrompt(false); void handleStart(); }}>
        {t('liveExchange.findSomeoneAgain')}
       </button>
      </div>
     </div>
    ) : (
     <div className="w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
      <button onClick={() => setShowAiPrompt(false)} aria-label={t('setup.close')} className="absolute top-4 right-4 opacity-60 hover:opacity-100 text-sm w-7 h-7 flex items-center justify-center z-10 bg-white/70 rounded-full">✕</button>
      <AIPractice available onStarted={() => refresh()} onEnded={() => { refresh(); setShowAiPrompt(false); }} />
     </div>
    )}
   </div>
  )}
  </AppShell>
 </div>;
}
