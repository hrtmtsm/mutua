'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase, getMessages, sendMessage, type Message } from '@/lib/supabase';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { track } from '@/lib/analytics';
import { markPop } from '@/lib/navigation';

export default function ChatPage() {
  const router  = useRouter();
  const params  = useParams();
  const matchId = params.matchId as string;

  const [myId,         setMyId]         = useState('');
  const [partnerName,  setPartnerName]  = useState('');
  const [avatarBg,     setAvatarBg]     = useState('#171717');
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [draft,        setDraft]        = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sessionId = localStorage.getItem('mutua_session_id') ?? '';
    setMyId(sessionId);
    if (!sessionId || !matchId) return;

    async function load() {
      const { data: match } = await supabase
        .from('matches')
        .select('id, name_a, name_b, session_id_a, session_id_b, native_language_a, native_language_b')
        .eq('id', matchId)
        .maybeSingle();

      if (!match) { setLoading(false); return; }

      const isA = match.session_id_a === sessionId;
      const partnerSid = isA ? match.session_id_b : match.session_id_a;
      const partnerLang = isA ? (match.native_language_b ?? '') : (match.native_language_a ?? '');
      setAvatarBg(LANG_AVATAR_COLOR[partnerLang] ?? '#171717');
      setPartnerName(isA ? (match.name_b ?? 'Partner') : (match.name_a ?? 'Partner'));

      const { data: prof } = await supabase
        .from('profiles').select('name, avatar_url').eq('session_id', partnerSid).maybeSingle();
      if (prof?.name)      setPartnerName(prof.name);
      if (prof?.avatar_url) setAvatarUrl(prof.avatar_url);

      const msgs = await getMessages(matchId);
      setMessages(msgs);
      setLoading(false);

      // Mark as read
      localStorage.setItem('mutua_last_seen_msg_ts', new Date().toISOString());
      if (msgs.length) localStorage.setItem(`mutua_last_seen_${matchId}`, msgs[msgs.length - 1].id);

      // Real-time
      const ch = supabase
        .channel(`chat:${matchId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
          const msg = payload.new as Message;
          if (msg.match_id !== matchId) return;
          // Own messages are already shown optimistically — only add partner messages
          if (msg.sender_id === sessionId) return;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }

    const cleanup = load();
    return () => { cleanup.then(fn => fn?.()); };
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [loading]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !myId) return;
    setDraft('');
    setError('');
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      match_id: matchId,
      sender_id: myId,
      text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      await sendMessage(matchId, myId, text);
      track('message_sent');
    } catch {
      setError('Failed to send. Try again.');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    }
  };

  const ini = partnerName.trim()
    ? partnerName.trim().split(/\s+/).filter(Boolean).map((p, i, arr) =>
        i === 0 || i === arr.length - 1 ? p[0].toUpperCase() : ''
      ).join('')
    : '?';

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-10 bg-white border-b border-stone-100 flex items-center gap-3 px-4 h-14 shrink-0">
        <button onClick={() => { markPop(); router.back(); }} className="p-1.5 -ml-1.5 text-stone-400 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {loading ? null : avatarUrl
          ? <img src={avatarUrl} alt={partnerName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          : <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-black" style={{ backgroundColor: avatarBg }}>{ini}</div>
        }
        <span className="font-semibold text-neutral-900">{partnerName || ' '}</span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 mt-14">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-stone-400 text-center mt-8">Say hello!</p>
        ) : messages.map(m => {
          const isMe = m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <span className={`px-4 py-2.5 rounded-2xl text-sm max-w-[78%] leading-relaxed ${
                isMe ? 'bg-neutral-900 text-white rounded-br-sm' : 'bg-stone-100 text-neutral-700 rounded-bl-sm'
              }`}>{m.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-rose-500 shrink-0">{error}</p>}

      {/* Compose */}
      <div className="shrink-0 px-4 py-3 border-t border-stone-100 flex gap-2 items-center bg-white pb-safe">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message..."
          className="flex-1 text-base px-4 py-2.5 border border-stone-200 rounded-2xl focus:outline-none focus:border-neutral-400 bg-stone-50"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="p-2.5 btn-primary text-white rounded-2xl disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
