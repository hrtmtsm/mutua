'use client';
import { LoadingStatus } from '@/app/loading';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {authorizedFetch,loadPracticeDetail,type VoiceSession} from '@/lib/practice';
import {supabase} from '@/lib/supabase';
import {useLocale} from './LocaleProvider';
type HistoryItem = Pick<VoiceSession, 'id' | 'partner_type' | 'started_at' | 'learning_language_a'>;
type HistoryPage = { sessions: HistoryItem[]; nextCursor: string | null };
let recentHistory: { accessToken: string; page: HistoryPage } | null = null;

async function prefetchCall(id: string) {
 const { data: { session } } = await supabase.auth.getSession();
 if (session) await loadPracticeDetail(id, session.access_token);
}
export default function VoiceHistory(){
 const {t,locale}=useLocale();
 const [sessions, setSessions] = useState<HistoryItem[]>([]);
 const [cursor, setCursor] = useState<string | null>(null);
 const [failedCursor, setFailedCursor] = useState<{cursor: string | null; size?: number}>({cursor: null});
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);

 async function load(after: string | null = null, signal?: AbortSignal, size?: number) {
  setLoading(true);
  setLoadingMore(after !== null && size !== 15);
  setError('');
  try {
   const { data: { session } } = await supabase.auth.getSession();
   if (signal?.aborted) return;
   const accessToken = session?.access_token;
   if (recentHistory?.accessToken !== accessToken) recentHistory = null;
   if (!after && recentHistory) {
    setSessions(recentHistory.page.sessions);
    setCursor(recentHistory.page.nextCursor);
   }
   const params = new URLSearchParams({ history: '1' });
   if (after) params.set('cursor', after);
   if (size) params.set('size', String(size));
   const response = await authorizedFetch('/api/practice?' + params, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : undefined });
   const data = await response.json();
   if (signal?.aborted) return;
   if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
     recentHistory = null;
     setSessions([]);
     setCursor(null);
    }
    throw new Error(data.error || t('voiceHistory.loadFailed'));
   }
   if (!after && accessToken) recentHistory = { accessToken, page: data };
   setSessions(previous => after ? [...previous, ...data.sessions] : data.sessions);
   setCursor(data.nextCursor);
   if (!after && data.nextCursor) {
    await load(data.nextCursor, signal, 15);
   }
  } catch (error) {
   if (!signal?.aborted) {
    setFailedCursor({cursor: after, size});
    setError(error instanceof Error ? error.message : t('voiceHistory.loadFailed'));
   }
  } finally {
   if (!signal?.aborted) {
    setLoading(false);
    setLoadingMore(false);
   }
  }
 }
 useEffect(() => {
  const controller = new AbortController();
  void load(null, controller.signal);
  return () => controller.abort();
 }, []);
 return (
  <section className="space-y-3 p-5">
   {error && <p role="alert">{error} <button className="underline" onClick={() => void load(failedCursor.cursor, undefined, failedCursor.size)}>{t('voiceHistory.retry')}</button></p>}
   {!loading && !error && !sessions.length && <p className="text-sm">{t('voiceHistory.emptyState')}</p>}
   <ul className="space-y-2">
    {sessions.map(session => (
     <li key={session.id}>
      <Link className="block rounded-lg bg-[color-mix(in_srgb,currentColor_5%,transparent)] px-4 py-3 motion-safe:transition-colors hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] focus-visible:bg-[color-mix(in_srgb,currentColor_12%,transparent)] focus-visible:outline focus-visible:outline-2" href={`/calls/${session.id}`} onPointerEnter={event => { if (event.pointerType === 'mouse') void prefetchCall(session.id).catch(() => {}); }} onFocus={() => void prefetchCall(session.id).catch(() => {})}>
       <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{session.partner_type === 'ai' ? 'Cue' : t('liveExchange.partnerFallbackName')}</span>
        {session.started_at && <time className="text-sm text-[var(--muted)]" dateTime={session.started_at}>{new Date(session.started_at).toLocaleString()}</time>}
       </div>
       <span className="mt-1 block text-sm text-[var(--muted)]">{session.learning_language_a}</span>
      </Link>
     </li>
    ))}
   </ul>
   {loading && (sessions.length === 0 || loadingMore) && <LoadingStatus />}
   {cursor && !loading && !error && (
    <button type="button" className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-current/5 focus-visible:outline" onClick={() => void load(cursor)}>
     {locale === 'ja' ? 'もっと読む' : 'Load more'}
    </button>
   )}
  </section>
 );
}
