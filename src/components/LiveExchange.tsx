'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import localFont from 'next/font/local';
import { supabase } from '@/lib/supabase';
import { liveAction, type LiveSnapshot, type LiveMessage } from '@/lib/liveExchange';
import { useLiveAudio } from '@/hooks/useLiveAudio';
import AppShell from './AppShell';
import SetupModal from './SetupModal';
import { defaultAvatarFor } from '@/lib/glyphAvatars';
import { LANGUAGES, type Language } from '@/lib/types';
import LanguagePicker from './LanguagePicker';
import './liveExchange.css';

const liveFont = localFont({ src: '../app/preview/sky/fonts/Nunito-Variable.ttf', variable: '--font-live-logo', weight: '200 1000', display: 'swap' });

export default function LiveExchange() {
 const [user, setUser] = useState<User|null>(null);
 const [authLoaded, setAuthLoaded] = useState(false);
 const [profileReady, setProfileReady] = useState(false);
 const [profileLoaded, setProfileLoaded] = useState(false);
 const [pendingStart, setPendingStart] = useState(false);
 const startRead = useRef(false);
 const [setup, setSetup] = useState(false);
 const [snapshot, setSnapshot] = useState<LiveSnapshot|null>(null);
 const [messages, setMessages] = useState<LiveMessage[]>([]);
 const [input, setInput] = useState('');
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 const [sending, setSending] = useState(false);
 const [muted, setMuted] = useState(false);
 const [audioBlocked, setAudioBlocked] = useState(false);
 const [expired, setExpired] = useState(false);
 const [stoppedByUser, setStoppedByUser] = useState(false);
 const [sessionId, setSessionId] = useState('');
 const [nativeLanguage, setNativeLanguage] = useState<Language | ''>('');
 const [learningLanguage, setLearningLanguage] = useState<Language | ''>('');
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
 const call = active && snapshot?.call?.status === 'accepted' ? snapshot.call : null;
 const partner = snapshot?.partner;
 const loadProfile = useCallback(async (account: User) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('email', account.email!)
   .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (sessionUser.current !== account.id) return;
  if (error) { setError('プロフィールを読み込めませんでした。'); return; }
  setProfileReady(!!data?.native_language && !!data?.learning_language);
  setProfileLoaded(true);
  if (data) {
   setSessionId(data.session_id);
   setNativeLanguage(data.native_language ?? '');
   setLearningLanguage(data.learning_language ?? '');
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
  setSessionId(''); setNativeLanguage(''); setLearningLanguage('');
  requestVersion.current++;
  if (user) loadProfile(user);
 }, [user?.id, loadProfile]);
 const apply = useCallback((next: LiveSnapshot) => {
  const previous = currentRef.current;
  if (previous?.queue && !next.queue && !next.conversation) setExpired(true);
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
  } catch (error) { if (identity === sessionUser.current) setError(error instanceof Error ? error.message : '接続エラー'); }
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
  if (commandBusy.current) throw new Error('操作の完了をお待ちください。');
  commandBusy.current = true; const version = ++requestVersion.current;
  const identity = sessionUser.current;
  try {
   const next = await liveAction(action, data);
   if (version === requestVersion.current && identity === sessionUser.current) apply(next);
   return next;
  } finally { commandBusy.current = false; }
 };
 const perform = async (action: string, data: Record<string, unknown> = {}) => {
  setError(''); setBusy(true);
  try { await command(action, data); }
  catch (error) { setError(error instanceof Error ? error.message : '操作に失敗しました。'); }
  finally { setBusy(false); }
 };
 const stopFailedCall = (reason: string) => {
  if (!call || failedCall.current === call.id) return;
  failedCall.current = call.id;
  setError(reason);
  const failedCallId = call.id;
  liveAction('end_call', { conversationId: call.conversation_id, callId: failedCallId, reason: 'media_failure' })
   .then(next => { if (currentRef.current?.call?.id === failedCallId) { requestVersion.current++; apply(next); } })
   .catch(() => { if (currentRef.current?.call?.id === failedCallId) setError(`${reason} 通話終了の同期に失敗しました。「会話を終了」を押してください。`); });
 };
 const rtc = useLiveAudio({ callId: call?.id, conversationId: call?.conversation_id,
  myId: user?.id, partnerId: partner?.id, muted, onFailure: stopFailedCall });
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
 const join = async () => {
  if (!authLoaded) return;
  if (!user || !profileReady) { setPendingStart(true); setSetup(true); return; }
  setExpired(false);
  setError(''); setBusy(true);
  try {
   const current = await command('state');
   if (!current.queue && current.conversation?.status !== 'active') await command('join', { kind: 'text' });
  } catch (error) { setError(error instanceof Error ? error.message : '接続できませんでした。'); }
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
  if (hasStart || requestedNative || requestedLearning) {
   params.delete('start'); params.delete('native'); params.delete('learning');
   window.history.replaceState(null, '', window.location.pathname + (params.size ? `?${params}` : '') + window.location.hash);
  }
  // Pass the URL-derived values straight through instead of reading
  // nativeLanguage/learningLanguage state here — the setState calls above
  // haven't committed yet within this same effect, so the state would
  // still read as whatever it was before this effect ran.
  if (hasStart) void startWith(
   requestedNative && (LANGUAGES as readonly string[]).includes(requestedNative) ? requestedNative as Language : null,
   requestedLearning && (LANGUAGES as readonly string[]).includes(requestedLearning) ? requestedLearning as Language : null,
  );
 }, [authLoaded, user?.id, profileLoaded]);
 useEffect(() => {
  if (!pendingStart || setup || !user || !profileReady) return;
  setPendingStart(false); void join();
 }, [pendingStart, setup, user?.id, profileReady]);
 const saveLanguages = async (native: Language, learning: Language) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/save-profile', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
   body: JSON.stringify({ session_id: sessionId, native_language: native, learning_language: learning }),
  });
  if (!res.ok) throw new Error('言語設定を保存できませんでした。');
 };
 // Start: the explicit entry point (preview screen's button, or the landing
 // page's ?native=/?learning=) — saves any condition change first (when
 // there's a profile to save it to), and only then joins. Takes explicit
 // overrides rather than always reading nativeLanguage/learningLanguage
 // state, so a value that just arrived via URL params is never skipped
 // while waiting for its own setState to commit.
 const startWith = async (overrideNative: Language | null, overrideLearning: Language | null) => {
  const native = overrideNative ?? nativeLanguage;
  const learning = overrideLearning ?? learningLanguage;
  if (user && profileReady && native && learning) {
   if (native === learning) { setError('母語と学習言語は別の言語を選んでください。'); return; }
   setError(''); setBusy(true);
   try { await saveLanguages(native, learning); }
   catch (error) { setError(error instanceof Error ? error.message : '言語設定を保存できませんでした。'); setBusy(false); return; }
   setBusy(false);
  }
  setStoppedByUser(false);
  await join();
 };
 const handleStart = () => startWith(null, null);
 // Next: skip whatever's happening now (if anything) and look for someone new.
 const handleNext = async () => {
  if (!authLoaded) return;
  setStoppedByUser(false);
  setError(''); setBusy(true);
  try {
   const existing = currentRef.current;
   if (existing?.conversation?.status === 'active') await command('end', { conversationId: existing.conversation.id, callId: existing.call?.id });
   else if (existing?.queue) await command('cancel');
   if (!user || !profileReady) { setPendingStart(true); setSetup(true); return; }
   setExpired(false);
   await command('join', { kind: 'text' });
  } catch (error) { setError(error instanceof Error ? error.message : '接続できませんでした。'); }
  finally { setBusy(false); }
 };
 // Stop: end/cancel whatever's happening and stay paused until Next is pressed again.
 const handleStop = async () => {
  setStoppedByUser(true);
  setError(''); setBusy(true);
  try {
   const existing = currentRef.current;
   if (existing?.conversation?.status === 'active') await command('end', { conversationId: existing.conversation.id, callId: existing.call?.id });
   else if (existing?.queue) await command('cancel');
  } catch (error) { setError(error instanceof Error ? error.message : '操作に失敗しました。'); }
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
  } catch (error) { setError(error instanceof Error ? error.message : '送信できませんでした。'); }
  finally { setSending(false); }
 };
 const actionData = { conversationId: conversation?.id, callId: snapshot?.call?.id };
 return <div className={liveFont.variable}>
  <AppShell>
  <main className="flex-1 flex flex-col min-h-[640px] md:min-h-[calc(100vh-56px)]">
   <div className="live-exchange-scene flex-1 p-6 md:p-10">
    <div className="live-content">
    <audio ref={audioRef} autoPlay playsInline data-testid="remote-audio" data-connection-state={rtc.state} data-sent-bytes={rtc.stats.sentBytes} data-received-bytes={rtc.stats.receivedBytes} data-received-energy={rtc.stats.receivedEnergy} />
    {error && <div role="alert" className="live-error mb-4">{error}</div>}
    <div className="live-stage">
     {active ? (
      <div className="live-split">
       <section className="live-call-pane">
        <div className="live-call-tiles">
         <div className="live-call-tile">
          <span className="live-avatar-ring-lg"><img src={defaultAvatarFor(user?.id || 'guest')} alt="" /></span>
          <p className="live-tile-label">あなた</p>
         </div>
         <div className="live-call-tile">
          <span className="live-avatar-ring-lg"><img src={partner?.avatarUrl || defaultAvatarFor(partner?.id || 'guest')} alt="" /></span>
          <p className="live-tile-label">{partner?.name || '言語パートナー'}</p>
         </div>
        </div>
        <p className="live-pill-status">{partner?.nativeLanguage} → {partner?.learningLanguage}</p>
        {!call && snapshot?.call?.status !== 'ringing' && (!snapshot?.call || ['expired','declined','cancelled','ended'].includes(snapshot.call.status)) && (
         <button disabled={busy} onClick={() => perform('invite', actionData)} className="live-button">📞 通話を開始</button>
        )}
        {snapshot?.call?.status === 'ringing' && <>
         <p role="status" className="live-pill-status">{snapshot.call.from_user === user?.id ? '相手の応答を待っています…' : '通話のお誘いです'}</p>
         {snapshot.call.from_user === user?.id
          ? <button disabled={busy} onClick={() => perform('cancel_invite', actionData)} className="live-button-ghost">招待をキャンセル</button>
          : <div className="flex gap-2"><button disabled={busy} onClick={() => perform('accept', actionData)} className="live-button">承諾</button><button disabled={busy} onClick={() => perform('decline', actionData)} className="live-button-ghost">今はしない</button></div>}
        </>}
        {call && <>
         <p role="status" className="live-pill-status">{rtc.state === 'connected' ? '音声接続中' : rtc.state === 'failed' ? '音声接続に失敗しました' : '音声を接続しています…'}</p>
         <div className="flex gap-2">
          <button aria-pressed={muted} onClick={() => setMuted(value => !value)} className="live-button-ghost">{muted ? 'ミュート解除' : 'ミュート'}</button>
          <button disabled={busy} onClick={() => perform('end_call', actionData)} className="live-button-ghost">通話を終了</button>
         </div>
        </>}
        {!call && snapshot?.call && ['expired','declined','cancelled','ended'].includes(snapshot.call.status) && <p role="status" className="live-pill-status">{({ expired:'通話の招待は期限切れになりました。', declined:'通話の招待は断られました。', cancelled:'通話の招待はキャンセルされました。', ended: snapshot.call.ended_reason === 'media_failure' ? '音声接続に失敗しました。チャットは続けられます。' : '通話が終了しました。チャットは続けられます。' } as Record<string,string>)[snapshot.call.status]}</p>}
        {audioBlocked && <button onClick={() => audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setError('音声を再生できませんでした。'))} className="live-button-ghost">相手の音声を再生</button>}
       </section>
       <section className="live-card live-chat-pane">
        <div role="log" aria-label="チャットメッセージ" aria-live="polite" className="flex-1 min-h-0 overflow-y-auto space-y-3">
         {messages.length === 0 && <p className="live-pill-status text-center">マッチしました。挨拶してみましょう。</p>}
         {messages.map(message => <div key={message.id} className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
          <p className={`live-message ${message.sender_id === user?.id ? 'live-message-mine' : 'live-message-theirs'}`}>{message.body}</p>
         </div>)}<div ref={bottomRef} />
        </div>
        <form onSubmit={sendMessage} className="live-chat-input-bar">
         <input aria-label="メッセージ" value={input} onChange={event => setInput(event.target.value)} maxLength={2000} placeholder="メッセージを入力…" className="live-input" />
         <button disabled={sending || !input.trim() || busy} type="submit" className="live-button">{sending ? '送信中…' : '送信'}</button>
        </form>
       </section>
      </div>
     ) : (
      <>
       {(snapshot?.queue || stoppedByUser || (user && !profileReady) || conversation?.status === 'ended' || expired) && (
        <p className="live-pill-status text-center mb-3">
         {snapshot?.queue ? '相手を探しています… 最大90秒で終了します。'
          : stoppedByUser ? '一時停止中 — 下のボタンで再開します。'
          : user && !profileReady ? 'プロフィールの母語と学習言語を設定すると、すぐに始められます。'
          : expired ? '待機時間が終了しました。下のボタンでもう一度探せます。'
          : conversation?.ended_reason === 'peer_left' ? '相手が退出しました。下のボタンで次の相手を探せます。'
          : '会話は終了しました。下のボタンで次の相手を探せます。'}
        </p>
       )}
       <div className="live-split">
        <section className="live-call-pane">
         <div className="live-call-tiles">
          <div className="live-call-tile">
           <span className="live-avatar-ring-lg"><img src={defaultAvatarFor(user?.id || 'guest')} alt="" /></span>
           <p className="live-tile-label">あなた</p>
          </div>
          <div className="live-call-tile live-call-tile-empty">
           <p className="live-tile-empty-text">{snapshot?.queue ? '検索中…' : 'Not started'}</p>
           <p className="live-tile-label">相手</p>
          </div>
         </div>
         <p className="live-pill-status">通話(音声)はマッチ後、ここから誘えます</p>
        </section>
        <section className="live-card live-chat-pane">
         <div className="live-chat-pane-empty"><p className="live-pill-status">{snapshot?.queue ? '相手が見つかると、ここでメッセージを送れます' : 'マッチすると、ここでメッセージを送れます'}</p></div>
        </section>
       </div>
       {!snapshot?.queue && (
        <div className="live-start-row">
         <button disabled={busy || !authLoaded} onClick={handleStart} className="live-button live-start-button">▶ 開始する</button>
         {user && profileReady && (
          <div className="live-conditions" role="group" aria-label="条件">
           <LanguagePicker value={nativeLanguage} onChange={setNativeLanguage} placeholder="母語" disabled={busy} />
           <LanguagePicker value={learningLanguage} onChange={setLearningLanguage} placeholder="学習言語" disabled={busy} />
          </div>
         )}
        </div>
       )}
       <p className="live-note text-center mt-3">プロフィールの母語と学習言語が合う相手とマッチします。<Link href="/profile">プロフィール</Link></p>
      </>
     )}
    </div>
    {(active || snapshot?.queue) && <div className="live-control-bar">
     <button disabled={busy || !authLoaded} onClick={handleNext} className="live-control live-control-next live-button">⏭ Next</button>
     <button disabled={busy} onClick={handleStop} className="live-control live-control-stop">⏹ Stop</button>
    </div>}
    </div>
   </div>
  </main>
  <SetupModal open={setup} onClose={() => { setSetup(false); setPendingStart(false); }} onComplete={() => {
   setSetup(false); supabase.auth.getSession().then(({data}) => { setUser(data.session?.user ?? null); if (data.session?.user) loadProfile(data.session.user); });
  }} initialNative={nativeLanguage || undefined} initialLearning={learningLanguage || undefined} />
  </AppShell>
 </div>;
}
