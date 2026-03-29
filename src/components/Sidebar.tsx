'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { User, ArrowLeftRight, TrendingUp, Bell, ArrowLeft, Send } from 'lucide-react';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { supabase, getMessages, sendMessage, type Message } from '@/lib/supabase';
import { track } from '@/lib/analytics';

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
  const [avatarUrl, setAvatarUrl] = useState('');
  const [hasUnread, setHasUnreadState] = useState(false);

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
      setAvatarUrl(profile.avatar_url ?? '');
    }
    setHasUnreadState(
      !!localStorage.getItem('mutua_unread_notification') ||
      !!localStorage.getItem('mutua_unread_message')
    );
  }, [pathname]);

  const setHasUnread = (v: boolean) => setHasUnreadState(v);
  return { pathname, initials, avatarBg, avatarUrl, hasUnread, setHasUnread };
}

// ── Thread list ───────────────────────────────────────────────────────────────

function MessagesList({
  matchId, partnerName, messages, myId, onOpen, hasUnreadMsg,
}: {
  matchId: string | null;
  partnerName: string;
  messages: Message[];
  myId: string;
  onOpen: () => void;
  hasUnreadMsg: boolean;
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
          <p className={`text-sm leading-tight ${hasUnreadMsg ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-900'}`}>{partnerName}</p>
          <p className={`text-xs truncate mt-0.5 ${hasUnreadMsg ? 'text-neutral-700 font-medium' : 'text-stone-400'}`}>
            {last.sender_id === myId ? 'You: ' : ''}{last.text}
          </p>
        </div>
        {hasUnreadMsg && (
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
        )}
      </button>
    </div>
  );
}

// ── Chat detail ───────────────────────────────────────────────────────────────

function MessageChat({
  matchId, partnerName, messages: serverMessages, myId, onBack,
}: {
  matchId: string;
  partnerName: string;
  messages: Message[];
  myId: string;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>(serverMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync incoming messages from partner (avoid overwriting optimistic ones)
  useEffect(() => {
    setLocalMessages(prev => {
      const optimistics = prev.filter(m => m.id.startsWith('optimistic-'));
      const merged = [...serverMessages];
      // Re-append any optimistic messages not yet in server list
      for (const opt of optimistics) {
        if (!merged.some(m => m.text === opt.text && m.sender_id === opt.sender_id)) {
          merged.push(opt);
        }
      }
      return merged;
    });
  }, [serverMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  // Focus input when chat opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || !myId) return;
    setDraft('');
    setError('');
    // Optimistic update — show immediately
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      match_id: matchId,
      sender_id: myId,
      text,
      created_at: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, optimistic]);
    try {
      await sendMessage(matchId, myId, text);
      track('message_sent');
    } catch (e: any) {
      setError('Failed to send. Try again.');
      setLocalMessages(prev => prev.filter(m => m.id !== optimistic.id));
      console.error('sendMessage error:', e);
    }
  };

  const messages = localMessages;

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
          className="flex-1 text-base px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-neutral-400 bg-stone-50"
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
  const { pathname, initials, avatarBg, avatarUrl, hasUnread, setHasUnread } = useNavState();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab]   = useState<'notifications' | 'messages'>('notifications');
  const [msgView, setMsgView]     = useState<'list' | 'chat'>('list');
  const inboxRef = useRef<HTMLDivElement>(null);

  // Allow external components to open the chat directly
  useEffect(() => {
    const handler = () => {
      setInboxOpen(true);
      setInboxTab('messages');
      setMsgView('chat');
    };
    window.addEventListener('mutua:open-chat', handler);
    return () => window.removeEventListener('mutua:open-chat', handler);
  }, []);

  // Shared message state loaded once when inbox opens
  const [matchId, setMatchId]               = useState<string | null>(null);
  const [partnerName, setPartnerName]       = useState('Partner');
  const [myId, setMyId]                     = useState('');
  const [messages, setMessages]             = useState<Message[]>([]);
  const [scheduleState, setScheduleState]   = useState<string | null>(null);

  // Always-on: watch for scheduling updates + new messages → set unread dot
  useEffect(() => {
    const sessionId = localStorage.getItem('mutua_session_id');
    if (!sessionId) return;

    let prevState: string | null = null;

    async function init() {
      const { data: match } = await supabase
        .from('matches')
        .select('id, scheduling_state')
        .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!match) return;
      prevState = match.scheduling_state;

      // Check for unread on load: dot shows if the last message is from the partner
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (lastMsgs && lastMsgs.length > 0 && lastMsgs[0].sender_id !== sessionId) {
        localStorage.setItem('mutua_unread_message', '1');
        setHasUnread(true);
      }

      const scheduleChannel = supabase
        .channel(`nav-schedule:${match.id}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}`,
        }, payload => {
          const next = (payload.new as any).scheduling_state;
          if (next && next !== prevState) {
            prevState = next;
            localStorage.setItem('mutua_unread_notification', '1');
            setHasUnread(true);
          }
        })
        .subscribe();

      const msgChannel = supabase
        .channel(`nav-messages:${match.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
        }, payload => {
          const msg = payload.new as Message;
          if (msg.match_id === match.id && msg.sender_id !== sessionId) {
            localStorage.setItem('mutua_unread_message', '1');
            setHasUnread(true);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(scheduleChannel);
        supabase.removeChannel(msgChannel);
      };
    }

    const cleanup = init();
    return () => { cleanup.then(fn => fn?.()); };
  }, []);

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

      const { data: full } = await supabase
        .from('matches')
        .select('scheduling_state, scheduled_at')
        .eq('id', match.id)
        .maybeSingle();
      if (full) setScheduleState(full.scheduling_state ?? null);

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
    <header className="sticky top-0 z-20 bg-white border-b border-stone-200/60">
      <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center h-14">

        {/* Wordmark */}
        <Link href="/app" className="font-serif font-bold text-xl tracking-tight text-neutral-900 shrink-0">
          Mutua
        </Link>

        {/* Nav links — desktop only */}
        <nav className="hidden md:flex items-center gap-1 flex-1 ml-8">
          {DESKTOP_NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match.some(p => pathname === p || pathname.startsWith(p + '/'));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold transition-colors rounded-full ${
                  active ? 'text-neutral-900' : 'text-stone-400 hover:text-neutral-700'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 1.8} />
                {label}
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
            onClick={() => {
              setInboxOpen(o => !o);
              setMsgView('list');
              // Only clear notification unread on bell click; message unread clears when chat opens
              if (!!localStorage.getItem('mutua_unread_notification')) {
                localStorage.removeItem('mutua_unread_notification');
              }
              if (!localStorage.getItem('mutua_unread_message')) {
                setHasUnread(false);
              }
            }}
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
                <div className="px-4 py-4 space-y-2">
                  {scheduleState === 'scheduled' && (
                    <div className="flex items-start gap-3 p-3 bg-white border border-stone-100 rounded-xl">
                      <span className="text-base mt-0.5">📅</span>
                      <div>
                        <p className="text-xs font-semibold text-neutral-900">Session scheduled</p>
                        <p className="text-xs text-stone-500 mt-0.5">Your first session with {partnerName} has been confirmed.</p>
                      </div>
                    </div>
                  )}
                  {scheduleState === 'computing' && (
                    <div className="flex items-start gap-3 p-3 bg-white border border-stone-100 rounded-xl">
                      <span className="text-base mt-0.5">🔍</span>
                      <div>
                        <p className="text-xs font-semibold text-neutral-900">Finding a time</p>
                        <p className="text-xs text-stone-500 mt-0.5">We're matching your availability with {partnerName}.</p>
                      </div>
                    </div>
                  )}
                  {scheduleState === 'no_overlap' && (
                    <div className="flex items-start gap-3 p-3 bg-white border border-stone-100 rounded-xl">
                      <span className="text-base mt-0.5">⚠️</span>
                      <div>
                        <p className="text-xs font-semibold text-neutral-900">No overlapping times</p>
                        <p className="text-xs text-stone-500 mt-0.5">Update your availability so we can find a slot with {partnerName}.</p>
                      </div>
                    </div>
                  )}
                  {(scheduleState === 'pending_a' || scheduleState === 'pending_b' || scheduleState === 'pending_both') && (
                    <div className="flex items-start gap-3 p-3 bg-white border border-stone-100 rounded-xl">
                      <span className="text-base mt-0.5">🕐</span>
                      <div>
                        <p className="text-xs font-semibold text-neutral-900">Session rescheduled</p>
                        <p className="text-xs text-stone-500 mt-0.5">Waiting on availability to find a new time with {partnerName}.</p>
                      </div>
                    </div>
                  )}
                  {!scheduleState && (
                    <div className="py-4 text-center">
                      <p className="text-sm font-semibold text-neutral-900 mb-1">No notifications</p>
                      <p className="text-xs text-stone-400 leading-relaxed">We'll let you know when your session is confirmed.</p>
                    </div>
                  )}
                </div>
              ) : (
                <MessagesList
                  matchId={matchId}
                  partnerName={partnerName}
                  messages={messages}
                  myId={myId}
                  hasUnreadMsg={!!localStorage.getItem('mutua_unread_message')}
                  onOpen={() => {
                    setMsgView('chat');
                    localStorage.removeItem('mutua_unread_message');
                    localStorage.setItem('mutua_last_seen_msg_ts', new Date().toISOString());
                    setHasUnread(!!localStorage.getItem('mutua_unread_notification'));
                  }}
                />
              )}
            </div>
          )}

          {/* Profile avatar */}
          <Link href="/profile" className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity shrink-0"
            style={avatarUrl ? undefined : { backgroundColor: avatarBg }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              : (initials || <User className="w-4 h-4" />)
            }
          </Link>

        </div>

      </div>
    </header>
  );
}

export function BottomNav() {
  const { pathname } = useNavState();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-stone-200/60 flex items-center">
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
