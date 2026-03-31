'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, getMessages, sendMessage, type Message } from '@/lib/supabase';
import { LANG_FLAGS, LANG_AVATAR_COLOR } from '@/lib/constants';
import AppShell from '@/components/AppShell';
import { ArrowLeft, MessageCircle, Send, X, Calendar } from 'lucide-react';

interface PartnerData {
  name: string;
  nativeLang: string;
  learningLang: string;
  goal: string;
  commStyle: string;
  frequency: string;
  interests?: string;
  bio?: string;
  schedulingState: string;
  scheduledAt: string | null;
  avatarUrl: string | null;
}

function Avatar({ name, lang, avatarUrl }: { name: string; lang: string; avatarUrl?: string | null }) {
  const bg = LANG_AVATAR_COLOR[lang] ?? '#3b82f6';
  const [imgFailed, setImgFailed] = useState(false);
  if (avatarUrl && !imgFailed) {
    return (
      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
      </div>
    );
  }
  return (
    <div
      style={{ backgroundColor: bg }}
      className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-white text-2xl shrink-0"
    >
      {name.trim().slice(0, 2).toUpperCase()}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function ChatPanel({ matchId, myId, partnerName, partnerAvatarUrl, partnerLang, onClose }: {
  matchId: string; myId: string; partnerName: string; partnerAvatarUrl?: string | null; partnerLang: string; onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMessages(matchId).then(setMessages);
    const channel = supabase
      .channel(`partner-chat:${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as Message;
        if (msg.match_id === matchId) {
          setMessages(prev => {
            // Skip if already added optimistically
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev.filter(m => !m.id.startsWith('opt-')), msg];
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || !myId) return;
    setDraft('');
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      match_id: matchId,
      sender_id: myId,
      text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      await sendMessage(matchId, myId, text);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    }
  };

  const bg = LANG_AVATAR_COLOR[partnerLang] ?? '#3b82f6';
  const initials = (() => {
    const p = partnerName.trim().split(/\s+/);
    return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : partnerName.trim().slice(0, 2)).toUpperCase();
  })();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white border-l border-stone-200 flex flex-col overflow-hidden w-full max-w-xs sm:max-w-sm h-full shadow-xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 shrink-0">
          <button onClick={onClose} className="text-stone-400 hover:text-neutral-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          {partnerAvatarUrl ? (
            <img src={partnerAvatarUrl} alt={partnerName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: bg }}>
              {initials}
            </div>
          )}
          <p className="text-sm font-semibold text-neutral-900 flex-1">{partnerName}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-stone-400 text-center mt-6">No messages yet. Say hello!</p>
          ) : messages.map(m => {
            const isMe = m.sender_id === myId;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <span className={`px-3 py-2 rounded-2xl text-sm max-w-[75%] leading-relaxed ${
                  isMe ? 'bg-neutral-900 text-white rounded-br-sm' : 'bg-stone-100 text-neutral-500 rounded-bl-sm'
                }`}>{m.text}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="px-4 py-3 border-t border-stone-100 flex gap-2 items-center shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Message..."
            className="flex-1 text-sm px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-neutral-400 bg-stone-50"
          />
          <button onClick={send} disabled={!draft.trim()} className="p-2.5 btn-primary text-white rounded-xl disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PartnerProfilePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();

  const [partner, setPartner]   = useState<PartnerData | null>(null);
  const [myId, setMyId]         = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const sid = localStorage.getItem('mutua_session_id') ?? '';
    setMyId(sid);

    async function load() {
      const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (!match) { setLoading(false); return; }

      const isA = match.session_id_a === sid;
      const partnerSessionId = isA ? match.session_id_b : match.session_id_a;

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, interests, bio, avatar_url')
        .eq('session_id', partnerSessionId)
        .maybeSingle();

      const baseName = isA ? (match.name_b ?? 'Partner') : (match.name_a ?? 'Partner');

      // Construct avatar URL directly from storage path — more reliable than DB column
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const storageAvatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${partnerSessionId}.jpg`;

      setPartner({
        name:             profile?.name ?? baseName,
        nativeLang:       isA ? match.native_language_b : match.native_language_a,
        learningLang:     isA ? match.native_language_a : match.native_language_b,
        goal:             match.goal              ?? '',
        commStyle:        match.comm_style        ?? '',
        frequency:        match.practice_frequency ?? '',
        interests:        profile?.interests      ?? '',
        bio:              profile?.bio            ?? '',
        schedulingState:  match.scheduling_state  ?? 'pending_both',
        scheduledAt:      match.scheduled_at      ?? null,
        avatarUrl:        profile?.avatar_url     ?? storageAvatarUrl,
      });

      setLoading(false);
    }

    load();
  }, [matchId]);

  if (loading) return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full">
        <p className="text-sm text-stone-400">Loading...</p>
      </main>
    </AppShell>
  );

  if (!partner) return (
    <AppShell>
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full">
        <p className="text-sm text-stone-400">Partner not found.</p>
      </main>
    </AppShell>
  );

  const nativeFlag   = LANG_FLAGS[partner.nativeLang]   ?? '';
  const learningFlag = LANG_FLAGS[partner.learningLang] ?? '';
  const s = partner.schedulingState;

  return (
    <AppShell>
      <main className="flex-1 max-w-2xl mx-auto w-full pb-10">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <button onClick={() => router.back()} className="text-stone-400 hover:text-neutral-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-stone-100 hover:bg-stone-200 transition-colors rounded-full text-sm font-semibold text-neutral-700"
          >
            <MessageCircle className="w-4 h-4" />
            Message
          </button>
        </div>

        {/* Hero */}
        <div className="px-6 pb-8 flex flex-col items-center text-center gap-3">
          <Avatar name={partner.name} lang={partner.nativeLang} avatarUrl={partner.avatarUrl} />
          <div>
            <h1 className="font-serif font-bold text-3xl text-[#171717]">{partner.name}</h1>
            <p className="text-sm text-stone-400 mt-1">{nativeFlag} {partner.nativeLang} · Native</p>
            {partner.bio && (
              <p className="text-sm text-stone-500 mt-3 leading-relaxed max-w-xs">{partner.bio}</p>
            )}
          </div>
        </div>

        <div className="px-6 space-y-4">

          {/* Session */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
            <p className="text-xs font-semibold text-stone-400">Session</p>

            {s === 'scheduled' && partner.scheduledAt ? (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-400">Confirmed session</p>
                  <p className="font-semibold text-neutral-900 text-sm mt-0.5">{fmtDate(partner.scheduledAt)}</p>
                </div>
              </div>
            ) : s === 'computing' ? (
              <p className="text-sm text-stone-500">Finding a time that works for both of you…</p>
            ) : s === 'no_overlap' ? (
              <p className="text-sm text-stone-500">No overlapping availability yet. Update your free times to get matched.</p>
            ) : (
              <p className="text-sm text-stone-500">Waiting on availability from both sides.</p>
            )}
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <p className="text-xs font-semibold text-stone-400 px-5 pt-5 pb-3">Preferences</p>
            {[
              { label: 'Learning',   value: `${learningFlag} ${partner.learningLang}` },
              { label: 'Goal',       value: partner.goal },
              { label: 'Style',      value: partner.commStyle },
              { label: 'Frequency',  value: partner.frequency },
              ...(partner.interests ? [{ label: 'Interests', value: partner.interests }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3 border-t border-stone-100">
                <span className="text-xs font-semibold text-stone-400">{label}</span>
                <span className="text-sm font-medium text-neutral-700">{value}</span>
              </div>
            ))}
          </div>

        </div>
      </main>

      {chatOpen && (
        <ChatPanel
          matchId={matchId}
          myId={myId}
          partnerName={partner.name}
          partnerAvatarUrl={partner.avatarUrl}
          partnerLang={partner.nativeLang}
          onClose={() => setChatOpen(false)}
        />
      )}
    </AppShell>
  );
}
