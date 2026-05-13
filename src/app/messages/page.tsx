'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { markPop } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { BottomNav } from '@/components/Sidebar';
import type { Message } from '@/lib/supabase';

type Conversation = {
  matchId:     string;
  partnerName: string;
  avatarBg:    string;
  avatarUrl:   string | null;
  lastMessage: Message | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.trim().slice(0, 2)).toUpperCase();
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [myId, setMyId]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = localStorage.getItem('mutua_session_id') ?? '';
    setMyId(sessionId);
    if (!sessionId) { setLoading(false); return; }

    async function load() {
      const { data: matches } = await supabase
        .from('matches')
        .select('id, name_a, name_b, session_id_a, session_id_b, native_language_a, native_language_b, scheduling_state')
        .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
        .order('created_at', { ascending: false });

      if (!matches?.length) { setLoading(false); return; }

      const matchIds = matches.map(m => m.id);
      const partnerSids = matches.map(m =>
        m.session_id_a === sessionId ? m.session_id_b : m.session_id_a
      );

      const [{ data: allMessages }, { data: profiles }] = await Promise.all([
        supabase.from('messages').select('*').in('match_id', matchIds).order('created_at', { ascending: true }),
        supabase.from('profiles').select('session_id, name, avatar_url, native_language').in('session_id', partnerSids),
      ]);

      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.session_id, p]));
      const msgsByMatch: Record<string, Message[]> = {};
      for (const msg of (allMessages ?? [])) {
        (msgsByMatch[msg.match_id] ??= []).push(msg as Message);
      }

      const convos: Conversation[] = matches
        .filter(m => (msgsByMatch[m.id]?.length ?? 0) > 0)
        .map(m => {
          const isA = m.session_id_a === sessionId;
          const partnerSid = isA ? m.session_id_b : m.session_id_a;
          const profile = profileMap[partnerSid];
          const partnerLang = isA ? (m.native_language_b ?? '') : (m.native_language_a ?? '');
          const msgs = msgsByMatch[m.id] ?? [];
          return {
            matchId:     m.id,
            partnerName: profile?.name ?? (isA ? m.name_b : m.name_a) ?? 'Partner',
            avatarBg:    LANG_AVATAR_COLOR[partnerLang] ?? '#171717',
            avatarUrl:   profile?.avatar_url ?? null,
            lastMessage: msgs[msgs.length - 1] ?? null,
          };
        });

      setConversations(convos);
      localStorage.removeItem('mutua_unread_message');
      localStorage.setItem('mutua_last_seen_msg_ts', new Date().toISOString());
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-10 bg-white border-b border-stone-100 flex items-center gap-3 px-4 h-14 shrink-0">
        <button onClick={() => { markPop(); router.back(); }} className="p-1.5 -ml-1.5 text-stone-400 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-serif font-bold text-xl text-neutral-900">Messages</span>
      </header>

      <main className="flex-1 pb-24">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-16 text-center px-4">
            <p className="text-sm font-semibold text-neutral-900 mb-1">No messages</p>
            <p className="text-xs text-stone-400 leading-relaxed">
              Messages from your exchange partners will appear here.
            </p>
          </div>
        ) : (
          <div>
            {conversations.map(c => {
              const ini = initials(c.partnerName);
              const last = c.lastMessage;
              const lastSeenId = localStorage.getItem(`mutua_last_seen_${c.matchId}`);
              const hasUnread = !!last && last.sender_id !== myId && last.id !== lastSeenId;
              return (
                <button
                  key={c.matchId}
                  onClick={() => {
                    if (last) localStorage.setItem(`mutua_last_seen_${c.matchId}`, last.id);
                    router.push(`/messages/${c.matchId}`);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-stone-50 active:bg-stone-100 transition-colors text-left border-b border-stone-100 last:border-0"
                >
                  {c.avatarUrl
                    ? <img src={c.avatarUrl} alt={c.partnerName} className="w-11 h-11 rounded-full object-cover shrink-0" />
                    : <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-black" style={{ backgroundColor: c.avatarBg }}>{ini}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${hasUnread ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-900'}`}>
                      {c.partnerName}
                    </p>
                    {last && (
                      <p className={`text-sm truncate mt-0.5 ${hasUnread ? 'text-neutral-700 font-medium' : 'text-stone-400'}`}>
                        {last.sender_id === myId ? 'You: ' : ''}{last.text}
                      </p>
                    )}
                  </div>
                  {hasUnread && <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
