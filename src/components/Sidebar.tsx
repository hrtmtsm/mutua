'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { User, ArrowLeftRight, TrendingUp, Bell, ArrowLeft, Send } from 'lucide-react';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { supabase, getMessages, sendMessage, type Message } from '@/lib/supabase';

const BOTTOM_NAV = [
  {
    href: '/app',
    label: 'Exchanges',
    icon: ArrowLeftRight,
    match: ['/app', '/match-result', '/find-match', '/partners', '/session-confirmed', '/session-schedule', '/pre-session', '/session'],
  },
  {
    href: '/history',
    label: 'Progress',
    icon: TrendingUp,
    match: ['/history'],
  },
];

const DESKTOP_NAV = [...BOTTOM_NAV];

function useNavState() {
  const pathname = usePathname();
  const [initials, setInitials]   = useState('');
  const [avatarBg, setAvatarBg]   = useState('#171717');
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('mutua_profile');
    if (raw) {
      const profile = JSON.parse(raw);
      const name: string = profile.name ?? '';
      const parts = name.trim().split(' ');
      setInitials(parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase()
      );
      const lang: string = profile.native_language ?? '';
      setAvatarBg(LANG_AVATAR_COLOR[lang] ?? '#171717');
    }
    setHasUnread(!!localStorage.getItem('mutua_unread_notification'));
  }, [pathname]);

  return { pathname, initials, avatarBg, hasUnread };
}

// ── Thread list ───────────────────────────────────────────────────────────────

function MessagesList({
  matchId, partnerName, messages, myId, onOpen,
}: {
  matchId: string | null;
  partnerName: string;
  messages: Message[];
  myId: string;
  onOpen: () => void;
}) {
  if (!matchId || messages.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm font-semibold text-neutral-900 mb-1">No messages</p>
        <p className="text-xs text-stone-400 leading-relaxed">
          Messages from your exchange partners will appear here.
        </p>
      </div>
    );
  }

  const last = messages[messages.length - 1];
  const initials = partnerName.trim().slice(0, 2).toUpperCase();

  return (
    <div>
      <button
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center shrink-0">
          <span className="text-xs font-black text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 leading-tight">{partnerName}</p>
          <p className="text-xs text-stone-400 truncate mt-0.5">
            {last.sender_id === myId ? 'You: ' : ''}{last.text}
          </p>
        </div>
      </button>
    </div>
  );
}

// ── Chat detail ───────────────────────────────────────────────────────────────

function MessageChat({
  matchId, partnerName, messages, myId, onBack,
}: {
  matchId: string;
  partnerName: string;
  messages: Message[];
  myId: string;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || !myId) return;
    setDraft('');
    setError('');
    try {
      await sendMessage(matchId, myId, text);
    } catch (e: any) {
      setError('Failed to send. Try again.');
      console.error('sendMessage error:', e);
    }
  };

  const initials = partnerName.trim().slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col" style={{ height: '360px' }}>
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 shrink-0">
        <button onClick={onBack} className="text-stone-400 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-white">{initials}</span>
        </div>
        <p className="text-sm font-semibold text-neutral-900">{partnerName}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-stone-400 text-center mt-6">Say hello!</p>
        ) : messages.map(m => {
          const isMe = m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <span className={`px-3 py-2 rounded-2xl text-xs max-w-[78%] leading-relaxed ${
                isMe
                  ? 'bg-neutral-900 text-white rounded-br-sm'
                  : 'bg-stone-100 text-neutral-600 rounded-bl-sm'
              }`}>{m.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && <p className="px-4 pb-1 text-xs text-rose-500">{error}</p>}

      {/* Compose */}
      <div className="px-3 py-2.5 border-t border-stone-100 flex gap-2 items-center shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message..."
          className="flex-1 text-xs px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-neutral-400 bg-stone-50"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="p-2 btn-primary text-white rounded-xl disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Top nav ───────────────────────────────────────────────────────────────────

export default function TopNav() {
  const { pathname, initials, avatarBg, hasUnread } = useNavState();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab]   = useState<'notifications' | 'messages'>('notifications');
  const [msgView, setMsgView]     = useState<'list' | 'chat'>('list');
  const inboxRef = useRef<HTMLDivElement>(null);

  // Shared message state loaded once when inbox opens
  const [matchId, setMatchId]         = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('Partner');
  const [myId, setMyId]               = useState('');
  const [messages, setMessages]       = useState<Message[]>([]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (inboxRef.current && !inboxRef.current.contains(e.target as Node)) {
        setInboxOpen(false);
        setMsgView('list');
      }
    }
    if (inboxOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [inboxOpen]);

  // Load match + messages when inbox opens, subscribe to realtime
  useEffect(() => {
    if (!inboxOpen) return;
    const sessionId = localStorage.getItem('mutua_session_id');
    if (!sessionId) return;
    setMyId(sessionId);

    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const { data: match } = await supabase
        .from('matches')
        .select('id, name_a, name_b, session_id_a, session_id_b')
        .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!match) return;
      setMatchId(match.id);
      const isA = match.session_id_a === sessionId;
      setPartnerName(isA ? (match.name_b ?? 'Partner') : (match.name_a ?? 'Partner'));
      const msgs = await getMessages(match.id);
      setMessages(msgs);

      channelRef = supabase
        .channel(`inbox:${match.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
        }, payload => {
          const msg = payload.new as Message;
          if (msg.match_id === match.id) {
            setMessages(prev => [...prev, msg]);
          }
        })
        .subscribe();
    }
    load();

    return () => { if (channelRef) supabase.removeChannel(channelRef); };
  }, [inboxOpen]);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-stone-100">
      <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center h-14">

        {/* Wordmark */}
        <Link href="/app" className="font-serif font-black text-xl tracking-tight text-neutral-900 shrink-0">
          Mutua
        </Link>

        {/* Nav links — desktop only */}
        <nav className="hidden md:flex items-center gap-1 flex-1 ml-8">
          {DESKTOP_NAV.map(({ href, label, match }) => {
            const active = match.some(p => pathname === p || pathname.startsWith(p + '/'));
            return (
              <Link
                key={href}
                href={href}
                className={`relative px-3 py-1 text-sm font-semibold transition-colors ${
                  active ? 'text-neutral-900' : 'text-stone-400 hover:text-neutral-700'
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-neutral-900 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Spacer on mobile */}
        <div className="flex-1 md:hidden" />

        {/* Right side: bell + avatar */}
        <div className="flex items-center gap-3 shrink-0" ref={inboxRef}>

          {/* Bell */}
          <button
            onClick={() => { setInboxOpen(o => !o); setMsgView('list'); }}
            className="relative p-1.5 text-stone-400 hover:text-neutral-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>

          {/* Dropdown */}
          {inboxOpen && (
            <div className="absolute top-14 right-4 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden z-30">

              {/* Tabs — hidden when in chat view */}
              {msgView === 'list' && (
                <div className="flex border-b border-stone-100">
                  {(['notifications', 'messages'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setInboxTab(tab)}
                      className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                        inboxTab === tab
                          ? 'text-neutral-900 border-b-2 border-neutral-900'
                          : 'text-stone-400 hover:text-neutral-700'
                      }`}
                    >
                      {tab === 'notifications' ? 'Notifications' : 'Messages'}
                    </button>
                  ))}
                </div>
              )}

              {/* Content */}
              {msgView === 'chat' && matchId ? (
                <MessageChat
                  matchId={matchId}
                  partnerName={partnerName}
                  messages={messages}
                  myId={myId}
                  onBack={() => setMsgView('list')}
                />
              ) : inboxTab === 'notifications' ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-neutral-900 mb-1">No notifications</p>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    We'll let you know when your session is confirmed or your partner reaches out.
                  </p>
                </div>
              ) : (
                <MessagesList
                  matchId={matchId}
                  partnerName={partnerName}
                  messages={messages}
                  myId={myId}
                  onOpen={() => setMsgView('chat')}
                />
              )}
            </div>
          )}

          {/* Profile avatar */}
          <Link href="/profile" style={{ backgroundColor: avatarBg }} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity">
            {initials || <User className="w-4 h-4" />}
          </Link>

        </div>

      </div>
    </header>
  );
}

export function BottomNav() {
  const { pathname } = useNavState();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-stone-100 flex items-center">
      {BOTTOM_NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match.some(p => pathname === p || pathname.startsWith(p + '/'));
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              active ? 'text-neutral-900' : 'text-stone-400'
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
