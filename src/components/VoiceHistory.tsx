'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {authorizedFetch,type VoiceSession} from '@/lib/practice';
import {useLocale} from './LocaleProvider';
export default function VoiceHistory(){
 const {t}=useLocale();
 const [sessions,setSessions]=useState<VoiceSession[]>([]),[error,setError]=useState(''),[warning,setWarning]=useState(false);
 const load=async()=>{try{const r=await authorizedFetch('/api/practice');const d=await r.json();if(!r.ok)throw Error(d.error);setSessions(d.sessions);setWarning(d.legacyAccessNeedsReview);setError('');}catch(e){setError(e instanceof Error?e.message:t('voiceHistory.loadFailed'));}};
 useEffect(()=>{void load();},[]);
 const transcriptLabel:Record<string,string>={ready:t('voiceHistory.transcriptReady'),partial:t('voiceHistory.transcriptPartial'),disabled:t('voiceHistory.transcriptDisabled'),pending:t('voiceHistory.transcriptPending'),collecting:t('voiceHistory.transcriptCollecting')};
 return <section className="rounded-2xl border border-stone-200 p-5 space-y-3"><h2 className="font-bold text-lg">{t('voiceHistory.heading')}</h2>{error&&<p role="alert">{error} <button className="underline" onClick={load}>{t('voiceHistory.retry')}</button></p>}{warning&&<p role="status">{t('voiceHistory.legacyWarning')}</p>}{!error&&!sessions.length&&<p className="text-sm">{t('voiceHistory.emptyState')}</p>}<ul className="divide-y divide-stone-200">{sessions.map(s=><li key={s.id}><Link className="block py-3 focus-visible:outline focus-visible:outline-2 rounded" href={`/calls/${s.id}`}><span className="font-semibold">{s.partner_type==='ai'?t('voiceHistory.aiPartnerLabel'):t('liveExchange.partnerFallbackName')}</span> · {new Date(s.started_at!).toLocaleString()}<span className="block text-sm mt-1">{s.learning_language_a} / {t('voiceHistory.minutesSeconds').replace('{m}',String(Math.floor(s.duration_secs/60))).replace('{s}',String(s.duration_secs%60))} · {s.status==='ended'?t('voiceHistory.statusEnded'):t('voiceHistory.statusInCall')} · {t('voiceHistory.logPrefix')}{transcriptLabel[s.transcript_status]}</span></Link></li>)}</ul></section>;
}
