'use client';

import { LoadingStatus } from '@/app/loading';
import { DetailBackButton } from '@/components/DetailBackButton';
import { Button } from '@/components/ui/button';
import '@/components/liveExchange.css';

import { PrivacyLink } from '@/components/PrivacyNotice';
import {useEffect,useState,useCallback,useRef} from 'react';
import { useRouter } from 'next/navigation';
import { markPop } from '@/lib/navigation';
import {ArrowUp, BookOpen, CircleHelp, Lightbulb, LoaderCircle, MessageCircle, X} from 'lucide-react';
import AppShell from '@/components/AppShell';
import {authorizedFetch,fetchPracticeHistory,loadPracticeDetail,type PracticeDetail,type ReviewMessage} from '@/lib/practice';
import {supabase} from '@/lib/supabase';
import {useLocale} from '@/components/LocaleProvider';

export default function CallDetail({params}:{params:{id:string}}){
 const {t, locale}=useLocale();
 const router = useRouter();
 const [detail,setDetail]=useState<PracticeDetail|null>(null),[error,setError]=useState(''),[askError,setAskError]=useState(''),[me,setMe]=useState(''),[tab,setTab]=useState<'log'|'ask'>('log'),[quotes,setQuotes]=useState<string[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false);
 const load = useCallback(async (signal?: AbortSignal) => {
  try {
   const { data: { session } } = await supabase.auth.getSession();
   if (signal?.aborted) return;
   setMe(session?.user.id ?? '');
   if (!session) {
    setDetail(null);
    throw new Error(t('callDetail.loadFailed'));
   }
   const data = await loadPracticeDetail(params.id, session.access_token, !signal);
   if (signal?.aborted) return;
   setDetail(data);
   setError('');
  } catch (error) {
   if (!signal?.aborted) setError(error instanceof Error ? error.message : t('callDetail.loadFailed'));
  }
 }, [params.id, t]);
 useEffect(() => {
  const controller = new AbortController();
  setDetail(null);
  void load(controller.signal);
  return () => controller.abort();
 }, [load]);
 const [chatOpen, setChatOpen] = useState(true);
 const [chatHistory, setChatHistory] = useState<{id: string; messages: ReviewMessage[]} | null>(null);
 const [chatLoadError, setChatLoadError] = useState('');
 const [chatLoadAttempt, retryChatLoad] = useState(0);
 const chatLoaded = chatHistory?.id === params.id;
 const reflection = chatLoaded ? chatHistory.messages : [];
 const [desktop, setDesktop] = useState(false);
 useEffect(() => {
  const viewport = window.matchMedia('(min-width: 768px)');
  const update = () => setDesktop(viewport.matches);
  update();
  viewport.addEventListener('change', update);
  return () => viewport.removeEventListener('change', update);
 }, []);
 const showChat = chatOpen && (desktop || tab === 'ask');
 useEffect(() => {
  if (!showChat || chatLoaded) return;
  const controller = new AbortController();
  setChatLoadError('');
  void fetchPracticeHistory<ReviewMessage[]>(params.id, true, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]))
   .then(messages => { if (!controller.signal.aborted) setChatHistory({id: params.id, messages}); })
   .catch(() => { if (!controller.signal.aborted) setChatLoadError(t('callDetail.loadFailed')); });
  return () => controller.abort();
 }, [showChat, chatLoaded, params.id, chatLoadAttempt, t]);
 const openChat = () => {
  setChatOpen(true);
  setTab('ask');
 };
 const closeChat = () => {
  setChatOpen(false);
  setTab('log');
 };
 const [pendingQuestion, setPendingQuestion] = useState<{ text: string; quotes: string[] } | null>(null);
 const questionInput = useRef<HTMLTextAreaElement>(null);
 const chatLog = useRef<HTMLDivElement>(null);
 useEffect(() => {
  const log = chatLog.current;
  if (log && (pendingQuestion || chatHistory?.messages.length)) log.scrollTop = log.scrollHeight;
 }, [pendingQuestion, chatHistory, tab]);

 const send = async (retry?: ReviewMessage) => {
  const text = retry?.body ?? question.trim();
  if (busy || !chatLoaded || !text) return;
  const quotedIds = retry?.quoted_utterance_ids ?? quotes;
  setBusy(true);
  setAskError('');
  if (!retry) setPendingQuestion({ text, quotes: quotedIds });
  try {
   const response = await authorizedFetch('/api/practice/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: params.id, requestId: retry?.request_id || crypto.randomUUID(), question: text, quotedIds }),
   });
   const result = await response.json();
   if (!response.ok) throw Error(result.error);
   if (!retry) {
    setQuestion('');
    setQuotes([]);
   }
  } catch (error) {
   setAskError(error instanceof Error ? error.message : t('callDetail.answerFailed'));
  } finally {
   try {
    const messages = await fetchPracticeHistory<ReviewMessage[]>(params.id, true);
    setChatHistory({id: params.id, messages});
   } catch {
    setAskError(previous => previous || t('callDetail.loadFailed'));
    setChatHistory(null);
   }
   setPendingQuestion(null);
   setBusy(false);
  }
 };
 const [recording, setRecording] = useState<{ id: string; url: string } | null>(null);
 const [recordingCheckedId, setRecordingCheckedId] = useState<string | null>(null);
 const [recordingError, setRecordingError] = useState(false);
 const canReplay = detail?.session.partner_type === 'ai' && detail.session.status === 'ended';
 const recordingPath = '/api/practice/recording?sessionId=' + encodeURIComponent(params.id);
 useEffect(() => {
  if (!canReplay) return;
  const controller = new AbortController();
  let url: string | undefined;
  void authorizedFetch(recordingPath, { signal: controller.signal }).then(async response => {
   if (response.status === 404) return;
   if (!response.ok) throw new Error();
   const blob = await response.blob();
   if (controller.signal.aborted) return;
   url = URL.createObjectURL(blob);
   setRecording({ id: params.id, url });
  }).catch(() => { if (!controller.signal.aborted) setRecordingError(true); }).finally(() => {
   if (!controller.signal.aborted) setRecordingCheckedId(params.id);
  });
  return () => {
   controller.abort();
   if (url) URL.revokeObjectURL(url);
  };
 }, [canReplay, params.id, recordingPath]);
 const deleteRecording = async () => {
  setRecordingError(false);
  try {
   const response = await authorizedFetch(recordingPath, { method: 'DELETE' });
   if (!response.ok) throw new Error();
   if (recording) URL.revokeObjectURL(recording.url);
   setRecording(null);
  } catch {
   setRecordingError(true);
  }
 };
 const utterances = detail?.utterances.filter(utterance => utterance.final) ?? [];
 return <AppShell><main className="w-full bg-[var(--page)] text-[var(--ink)] md:flex md:h-dvh md:flex-col">
 <header className="flex shrink-0 items-center bg-[var(--surface)] px-5 py-4 md:px-8">
  <DetailBackButton icon="back" label={t('callDetail.backToHistory')} onClick={() => { markPop(); router.back(); }} />
 </header>
 {error&&<p role="alert" className="mx-5 my-5">{error} <button onClick={() => void load()} className="underline">{t('voiceHistory.retry')}</button></p>}
 {!detail && !error && <LoadingStatus />}
 {detail&&<>
  <div className={`md:grid md:min-h-0 md:flex-1 ${chatOpen ? 'md:grid-cols-[minmax(0,1fr)_clamp(19rem,30vw,28rem)]' : 'md:grid-cols-1'}`}>
   <Button
    className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-30 size-12 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] shadow-md hover:shadow-lg ${tab === 'ask' && chatOpen ? 'hidden' : chatOpen ? 'grid md:hidden' : 'grid'}`}
    aria-label={t('callDetail.askAiTab')}
    aria-controls="cue-review-chat"
    aria-expanded={false}
    onClick={openChat}
   >
    <span className="size-10" aria-hidden="true"><span className="ai-cloud-avatar ai-cloud-avatar--plain block" /></span>
   </Button>
   <section className={`${tab==='log'?'flex':'hidden'} min-h-0 flex-col bg-[var(--surface)] md:flex`} aria-label={t('callDetail.conversationLogLabel')}>
    <div className="min-h-0 flex-1 md:overflow-y-auto">
    <div className="mx-auto max-w-3xl px-5 pb-8 pt-4 md:px-12">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-lg font-semibold">{detail.session.partner_type==='ai'?t('callDetail.withAi'):t('callDetail.withHuman')}</h1>
      {utterances.length > 0 && (
       <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button className="h-8 rounded-lg border border-[var(--line)] bg-[var(--page)] px-2.5 text-xs text-[var(--ink)] hover:bg-current/10 disabled:opacity-50" disabled={busy} onClick={() => {
         setQuestion(locale === 'ja'
          ? 'この会話をもとに、似た場面をロールプレイしたいです。役立つ表現を取り入れながら、一往復ずつ練習してください。'
          : 'Help me role-play a similar situation from this call. Let’s take it one turn at a time and reuse useful phrases.');
         setQuotes([]);
         openChat();
         requestAnimationFrame(() => questionInput.current?.focus());
        }}>{locale === 'ja' ? 'この会話をもとに練習' : 'Practice with Cue'}</Button>
        <details className="relative">
         <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-lg hover:bg-current/5 [&::-webkit-details-marker]:hidden" aria-label={locale === 'ja' ? '練習内容について' : 'About this practice'}>
          <CircleHelp className="size-4" aria-hidden="true" />
         </summary>
         <p className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-sm shadow-md">
          {locale === 'ja'
           ? 'Cueがこの通話の文字起こしをもとに、似た場面での返し方や表現をチャットで一緒に練習します。'
           : 'Cue uses this transcript to role-play a similar situation in chat so you can try different replies and reuse phrases.'}
         </p>
        </details>
       </div>
      )}
     </div>
     <p className="mt-3 text-sm text-[var(--muted)]">{detail.session.started_at?new Date(detail.session.started_at).toLocaleString():t('callDetail.notConnected')} · {t('callDetail.durationLabel').replace('{s}',String(detail.session.duration_secs))}</p>
     <p className="mb-8 mt-3 text-sm text-[var(--muted)]">{t('callDetail.transcriptDisclaimer')}</p>
{detail.session.transcript_status==='partial'&&<p role="status" className="text-sm mb-3">{t('callDetail.partialTranscriptNotice')}</p>}{!utterances.length&&<p>{t('callDetail.noTranscriptYet')}</p>}<ol className="space-y-4">{utterances.map(u=><li key={u.id}><button aria-pressed={quotes.includes(u.id)} className={`w-full text-left rounded-lg border border-transparent px-3 py-2 leading-relaxed hover:bg-blue-500/5 focus-visible:outline focus-visible:outline-2 ${quotes.includes(u.id)?'border-blue-500 bg-blue-500/10':''}`} onClick={()=>{setQuotes(v=>v.includes(u.id)?v.filter(id=>id!==u.id):v.length<10?[...v,u.id]:v);}}><span className="text-xs font-semibold block mb-1 text-[var(--muted)]">{u.speaker_role==='assistant'?t('callDetail.aiSpeakerLabel'):u.speaker_id===me?t('app.you'):t('app.partner')} · {t('callDetail.quoteAction')}</span><span className="whitespace-pre-wrap">{u.body}</span></button></li>)}</ol></div></div>
   <footer className="shrink-0 border-t border-[var(--line)] px-5 py-3 md:px-8">
    <div className="mx-auto max-w-3xl">
     {recording?.id === params.id && (
      <div className="flex flex-wrap items-center gap-3">
       <audio controls preload="metadata" src={recording.url} className="max-w-full" />
       <button type="button" className="text-sm underline" onClick={deleteRecording}>Delete recording</button>
      </div>
     )}
     {recording?.id !== params.id && !recordingError && (
      <p role="status" className="py-2 text-sm text-[var(--muted)]">
       {canReplay && recordingCheckedId !== params.id ? 'Loading recording…' : 'No recording available for this call.'}
      </p>
     )}
     {recordingError && <p role="alert" className="mt-3 text-sm">Could not load or delete the recording.</p>}
    </div>
   </footer>
   </section>
 <section id="cue-review-chat" hidden={!chatOpen} className={`${!chatOpen ? '!hidden' : tab === 'ask' ? 'flex' : 'hidden'} min-h-[65dvh] min-w-0 flex-col bg-[var(--surface)] p-5 md:flex md:min-h-0 md:border-l md:border-[var(--line)] md:p-6`} aria-label={t('callDetail.askAiSectionLabel')}>
  <div className="mb-2 flex shrink-0 justify-end">
   <Button className="grid size-9 place-items-center rounded-lg hover:bg-current/5" aria-label={locale === 'ja' ? 'Cue チャットを閉じる' : 'Close Cue chat'} onClick={closeChat}>
    <X className="size-4" aria-hidden="true" />
   </Button>
  </div>
  <div ref={chatLog} className="min-h-0 flex-1 space-y-5 overflow-y-auto" role="log" aria-live="polite">
   {!chatLoaded && (chatLoadError
    ? <p role="alert">{chatLoadError} <button className="underline" onClick={() => retryChatLoad(value => value + 1)}>{locale === 'ja' ? '再試行' : 'Retry'}</button></p>
    : <LoadingStatus />)}
   {chatLoaded && reflection.length === 0 && !pendingQuestion && (
    <div className="pb-4 pt-1">
     <div className="mb-4 size-20" aria-hidden="true"><div className="ai-cloud-avatar ai-cloud-avatar--plain" /></div>
     <h2 className="text-balance text-2xl font-bold">{t('callDetail.askAiTab')}</h2>
     <p className="mt-2 text-pretty text-sm text-[var(--muted)]">{t('callDetail.askAiIntro')}</p>
     {utterances.length > 0 && (
      <ul className="mt-5 space-y-1">
       {[
        { icon: BookOpen, text: locale === 'ja' ? 'この会話で使われた表現を、例文つきで教えて' : 'Explain a phrase from this call with an example' },
        { icon: Lightbulb, text: locale === 'ja' ? '私の発言をもっと自然に言うと？' : 'How could I say what I meant more naturally?' },
        { icon: MessageCircle, text: locale === 'ja' ? '相手の最後の発言に、どう返せばいい？' : 'How could I respond to the last thing my partner said?' },
       ].map(({ icon: Icon, text }) => (
        <li key={text}>
         <Button className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-current/5" onClick={() => setQuestion(text)}>
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {text}
         </Button>
        </li>
       ))}
      </ul>
     )}
    </div>
   )}
   {reflection.map(message => (
    <div key={message.id} className={message.role === 'user' ? 'ml-auto w-fit max-w-[90%] rounded-2xl bg-blue-500/15 px-4 py-2.5' : 'pr-2'}>
     <span className="sr-only">{t(message.role === 'user' ? 'app.you' : 'callDetail.aiSpeakerLabel')}</span>
     {message.quoted_utterance_ids.length > 0 && (
      <blockquote className="mb-2 break-words border-l-2 pl-2 text-sm">{message.quoted_utterance_ids.map(id => detail.utterances.find(u => u.id === id)?.body).join(' / ')}</blockquote>
     )}
     <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body || t(message.status === 'pending' ? 'callDetail.answerGenerating' : 'callDetail.answerFailed')}</p>
     {message.role === 'assistant' && message.status === 'failed' && (
      <button className="mt-2 underline" disabled={busy} onClick={() => {
       const original = reflection.find(item => item.request_id === message.request_id && item.role === 'user');
       if (original) void send(original);
      }}>{t('callDetail.retrySameQuestion')}</button>
     )}
    </div>
   ))}
   {pendingQuestion && (
    <div className="ml-auto w-fit max-w-[90%] rounded-2xl bg-blue-500/15 px-4 py-2.5 text-sm">
     {utterances.filter(u => pendingQuestion.quotes.includes(u.id)).map(u => (
      <blockquote key={u.id} className="mb-2 break-words border-l-2 pl-2">{u.body}</blockquote>
     ))}
     <p className="whitespace-pre-wrap break-words">{pendingQuestion.text}</p>
    </div>
   )}
   {busy && (
    <div className="flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
     <div className="size-9 shrink-0" aria-hidden="true"><div className="ai-cloud-avatar ai-cloud-avatar--plain" /></div>
     {t('callDetail.answerGenerating')}
    </div>
   )}
  </div>
  {askError && <p role="alert" className="my-3">{askError}</p>}
  <form className="mt-4 shrink-0" onSubmit={e=>{e.preventDefault();void send();}}>
 <div data-slot="input-group" role="group" aria-label={t('callDetail.questionLabel')} className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--page)] p-3 focus-within:border-blue-500">
 {quotes.length > 0 && !pendingQuestion && (
  <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <p>{t('callDetail.quotingCount').replace('{n}', String(quotes.length))}</p>
    <button type="button" className="underline" onClick={() => setQuotes([])}>{t('callDetail.removeQuotes')}</button>
   </div>
   <div className="max-h-28 space-y-2 overflow-y-auto">
    {utterances.filter(utterance => quotes.includes(utterance.id)).map(utterance => (
     <blockquote key={utterance.id} className="whitespace-pre-wrap break-words border-l-2 border-blue-500/50 pl-2 text-[var(--muted)]">{utterance.body}</blockquote>
    ))}
   </div>
  </div>
 )}
 <label className="block"><span className="sr-only">{t('callDetail.questionLabel')}</span><textarea ref={questionInput} data-slot="input-group-control" className="block w-full max-h-36 resize-none overflow-y-auto bg-transparent px-1 py-1 outline-none [field-sizing:content]" value={pendingQuestion ? '' : question} disabled={busy} maxLength={2000} rows={1} onChange={e=>setQuestion(e.target.value)} placeholder={t('callDetail.questionPlaceholder')}/></label>
 <div data-slot="input-group-addon" data-align="block-end" className="flex justify-end">
  <Button type="submit" className="grid size-8 place-items-center rounded-full btn-primary text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" aria-label={busy ? t('callDetail.waitingForAnswer') : t('callDetail.askAiButton')} disabled={busy || !chatLoaded || !question.trim() || !utterances.length}>
   {busy ? <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4" aria-hidden="true" />}
  </Button>
 </div>
 </div>
 {detail.utterances.length > 0 && !reflection.some(message => message.role === 'user') && (
  <p className="mt-2 text-xs text-[var(--muted)]">
   <PrivacyLink section="ai-review" label="privacy.details" />
  </p>
 )}
</form></section>
 </div></>}</main></AppShell>;
}
