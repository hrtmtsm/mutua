'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { User, ArrowLeftRight, TrendingUp, Bell, ArrowLeft, Send, Settings, MessageSquarePlus, X, Users, Calendar } from 'lucide-react';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { supabase, getMessages, sendMessage, type Message } from '@/lib/supabase';
import { track } from '@/lib/analytics';

const BOTTOM_NAV = [
  {
    href: '/app',
    label: 'Partners',
    icon: Users,
    match: ['/app', '/match-result', '/find-match', '/partners', '/partner'],
  },
  {
    href: '/exchanges',
    label: 'Exchanges',
    icon: ArrowLeftRight,
    match: ['/exchanges', '/session-confirmed', '/session-schedule', '/pre-session', '/session'],
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
  const [name,     setName]       = useState('');
  const [avatarBg, setAvatarBg]   = useState('#171717');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [hasUnread, setHasUnreadState] = useState(false);
  const [hasRematchBadge, setHasRematchBadge] = useState(false);

  const refreshProfile = () => {
    const raw = localStorage.getItem('mutua_profile');
    if (raw) {
      const profile = JSON.parse(raw);
      const n: string = profile.name ?? '';
      const parts = n.trim().split(' ');
      setInitials(parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : n.slice(0, 2).toUpperCase()
      );
      setName(n);
      const lang: string = profile.native_language ?? '';
      setAvatarBg(LANG_AVATAR_COLOR[lang] ?? '#171717');
      setAvatarUrl(profile.avatar_url ?? '');
      setSessionId(profile.session_id ?? '');
    }
    setHasUnreadState(
      !!localStorage.getItem('mutua_unread_notification') ||
      !!localStorage.getItem('mutua_unread_message')
    );
  };

  useEffect(() => { refreshProfile(); }, [pathname]);

  useEffect(() => {
    window.addEventListener('mutua:profile-updated', refreshProfile);
    return () => window.removeEventListener('mutua:profile-updated', refreshProfile);
  }, []);

  // Poll for pending rematch intents from partner; clear badge on history page
  useEffect(() => {
    if (pathname === '/history') { setHasRematchBadge(false); return; }
    const sid = localStorage.getItem('mutua_session_id');
    if (!sid) return;

    const check = async () => {
      const { data: myMatches } = await supabase
        .from('matches')
        .select('id')
        .or(`session_id_a.eq.${sid},session_id_b.eq.${sid}`)
        .neq('scheduling_state', 'archived');

      const ids = (myMatches ?? []).map((m: any) => m.id);
      if (ids.length === 0) { setHasRematchBadge(false); return; }

      const { data: intents } = await supabase
        .from('rematch_intents')
        .select('id')
        .in('match_id', ids)
        .neq('user_id', sid);

      setHasRematchBadge((intents ?? []).length > 0);
    };

    check();
    const t = setInterval(check, 15_000);
    return () => clearInterval(t);
  }, [pathname]);

  const setHasUnread = (v: boolean) => setHasUnreadState(v);
  return { pathname, initials, name, avatarBg, avatarUrl, sessionId, hasUnread, setHasUnread, hasRematchBadge };
}

// ── Thread list ───────────────────────────────────────────────────────────────

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

function MessagesList({
  conversations, myId, onOpen,
}: {
  conversations: Conversation[];
  myId: string;
  onOpen: (matchId: string, partnerName: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm font-semibold text-neutral-900 mb-1">No messages</p>
        <p className="text-xs text-stone-400 leading-relaxed">
          Messages from your exchange partners will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {conversations.map(c => {
        const ini = initials(c.partnerName);
        const last = c.lastMessage;
        return (
          <button
            key={c.matchId}
            onClick={() => onOpen(c.matchId, c.partnerName)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left border-b border-stone-50 last:border-0"
          >
            {c.avatarUrl
              ? <img src={c.avatarUrl} alt={c.partnerName} className="w-9 h-9 rounded-xl object-cover shrink-0" />
              : <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: c.avatarBg }}><span className="text-xs font-black text-white">{ini}</span></div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 leading-tight">{c.partnerName}</p>
              {last && (
                <p className="text-xs truncate mt-0.5 text-stone-400">
                  {last.sender_id === myId ? 'You: ' : ''}{last.text}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Chat detail ───────────────────────────────────────────────────────────────

function MessageChat({
  matchId, partnerName, messages: serverMessages, myId, onBack, avatarBg, avatarUrl,
}: {
  matchId: string;
  partnerName: string;
  messages: Message[];
  myId: string;
  onBack: () => void;
  avatarBg: string;
  avatarUrl?: string | null;
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

  const parts = partnerName.trim().split(/\s+/);
  const initials = (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : partnerName.trim().slice(0, 2)).toUpperCase();

  return (
    <div className="flex flex-col" style={{ height: '360px' }}>
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 shrink-0">
        <button onClick={onBack} className="text-stone-400 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        {avatarUrl
          ? <img src={avatarUrl} alt={partnerName} className="w-7 h-7 rounded-lg object-cover shrink-0" />
          : <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: avatarBg }}><span className="text-[10px] font-black text-white">{initials}</span></div>
        }
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
  const { pathname, initials, name, avatarBg, avatarUrl, hasUnread, setHasUnread, hasRematchBadge } = useNavState();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab]   = useState<'notifications' | 'messages'>('notifications');
  const [msgView, setMsgView]     = useState<'list' | 'chat'>('list');
  const inboxRef = useRef<HTMLDivElement>(null);

  // Profile dropdown
  const [profileOpen,   setProfileOpen]   = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  // Feedback modal
  const [showFeedback,    setShowFeedback]    = useState(false);
  const [feedbackText,    setFeedbackText]    = useState('');
  const [feedbackSent,    setFeedbackSent]    = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);


  // Allow external components to open the chat directly
  const [requestedMatchId, setRequestedMatchId] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const mid = (e as CustomEvent).detail?.matchId ?? null;
      setRequestedMatchId(mid);
      setInboxOpen(true);
      setInboxTab('messages');
      setMsgView('chat');
    };
    window.addEventListener('mutua:open-chat', handler);
    return () => window.removeEventListener('mutua:open-chat', handler);
  }, []);

  // All conversations for the list view
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Load all conversations whenever the inbox opens
  useEffect(() => {
    if (!inboxOpen) return;
    const sessionId = localStorage.getItem('mutua_session_id');
    if (!sessionId) return;

    async function loadConversations() {
      const { data: matches } = await supabase
        .from('matches')
        .select('id, name_a, name_b, session_id_a, session_id_b, native_language_a, native_language_b')
        .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
        .neq('scheduling_state', 'archived')
        .order('created_at', { ascending: false });

      if (!matches?.length) return;

      const matchIds = matches.map(m => m.id);

      // Fetch last message per match and all partner profiles in parallel
      const partnerSessionIds = matches.map(m =>
        m.session_id_a === sessionId ? m.session_id_b : m.session_id_a
      );
      const [{ data: allMessages }, { data: profiles }] = await Promise.all([
        supabase.from('messages').select('*').in('match_id', matchIds).order('created_at', { ascending: true }),
        supabase.from('profiles').select('session_id, name, avatar_url, native_language').in('session_id', partnerSessionIds),
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
    }

    loadConversations();
  }, [inboxOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared message state loaded once when inbox opens
  const [matchId, setMatchId]               = useState<string | null>(null);
  const [partnerName, setPartnerName]       = useState('Partner');
  const [myId, setMyId]                     = useState('');
  const [messages, setMessages]             = useState<Message[]>([]);
  const [scheduleState, setScheduleState]   = useState<string | null>(null);
  const [partnerAvatarBg, setPartnerAvatarBg] = useState('#171717');
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null);
  const currentSchedStateRef                = useRef<string | null>(null);

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
      currentSchedStateRef.current = match.scheduling_state;

      // Check for unread on load: dot shows if scheduling state changed since last visit
      const notifyStates = ['scheduled', 'no_overlap', 'pending_a', 'pending_b'];
      const lastSeen = localStorage.getItem('mutua_last_seen_sched_state');
      if (lastSeen && lastSeen !== match.scheduling_state && notifyStates.includes(match.scheduling_state)) {
        localStorage.setItem('mutua_unread_notification', '1');
        setHasUnread(true);
      }

      // Check for unread on load: dot shows if last message is from partner AND newer than last-seen
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('sender_id, created_at')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const lastSeenMsgTs = localStorage.getItem('mutua_last_seen_msg_ts');
      const msgIsUnread = lastMsgs && lastMsgs.length > 0
        && lastMsgs[0].sender_id !== sessionId
        && (!lastSeenMsgTs || new Date(lastMsgs[0].created_at) > new Date(lastSeenMsgTs));
      if (msgIsUnread) {
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
            currentSchedStateRef.current = next;
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

  // Load match + messages when inbox opens or target match changes
  useEffect(() => {
    if (!inboxOpen) return;
    const sessionId = localStorage.getItem('mutua_session_id');
    if (!sessionId) return;
    setMyId(sessionId);

    // Clear stale state immediately so old chat doesn't flash
    setMatchId(null);
    setMessages([]);
    setPartnerName('Partner');
    setPartnerAvatarUrl(null);
    setScheduleState(null);

    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      let matchQuery = supabase
        .from('matches')
        .select('id, name_a, name_b, session_id_a, session_id_b, native_language_a, native_language_b');

      if (requestedMatchId) {
        matchQuery = matchQuery.eq('id', requestedMatchId);
      } else {
        matchQuery = matchQuery
          .or(`session_id_a.eq.${sessionId},session_id_b.eq.${sessionId}`)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      const { data: match } = await matchQuery.maybeSingle();

      if (!match) return;
      setMatchId(match.id);
      const isA = match.session_id_a === sessionId;
      setPartnerName(isA ? (match.name_b ?? 'Partner') : (match.name_a ?? 'Partner'));
      const partnerLang = isA ? (match.native_language_b ?? '') : (match.native_language_a ?? '');
      setPartnerAvatarBg(LANG_AVATAR_COLOR[partnerLang] ?? '#171717');
      const partnerSessionId = isA ? match.session_id_b : match.session_id_a;
      const { data: pProfile } = await supabase.from('profiles').select('avatar_url, name').eq('session_id', partnerSessionId).maybeSingle();
      setPartnerAvatarUrl(pProfile?.avatar_url ?? null);
      if (pProfile?.name) setPartnerName(pProfile.name);
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
  }, [inboxOpen, requestedMatchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
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
            const showDot = href === '/history' && hasRematchBadge;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2 px-4 py-1.5 text-sm font-semibold transition-colors rounded-full ${
                  active ? 'text-neutral-900' : 'text-stone-400 hover:text-neutral-700'
                }`}
              >
                <span className="relative">
                  <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 1.8} />
                  {showDot && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
                  )}
                </span>
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
              // Mark current scheduling state as seen
              if (currentSchedStateRef.current) localStorage.setItem('mutua_last_seen_sched_state', currentSchedStateRef.current);
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
                  avatarBg={partnerAvatarBg}
                  avatarUrl={partnerAvatarUrl}
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
                  conversations={conversations}
                  myId={myId}
                  onOpen={(mid, pName) => {
                    setRequestedMatchId(mid);
                    setPartnerName(pName);
                    setMsgView('chat');
                    localStorage.removeItem('mutua_unread_message');
                    localStorage.setItem('mutua_last_seen_msg_ts', new Date().toISOString());
                    setHasUnread(!!localStorage.getItem('mutua_unread_notification'));
                  }}
                />
              )}
            </div>
          )}

          {/* Profile avatar + dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity shrink-0"
              style={avatarUrl ? undefined : { backgroundColor: avatarBg }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                : (initials || <User className="w-4 h-4" />)
              }
            </button>

            {profileOpen && (
              <div className="absolute top-11 right-0 w-64 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden z-30">
                {/* Header */}
                <Link href="/profile" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-stone-50 transition-colors border-b border-stone-100">
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white text-sm font-bold"
                    style={avatarUrl ? undefined : { backgroundColor: avatarBg }}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                      : (initials || <User className="w-4 h-4" />)
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{name || 'Your profile'}</p>
                    <p className="text-xs text-stone-400">View profile</p>
                  </div>
                </Link>

                {/* Settings + Feedback */}
                <div className="divide-y divide-stone-100">
                  <Link href="/settings" onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors">
                    <Settings className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="text-sm font-medium text-neutral-700">Settings</span>
                  </Link>
                  <button
                    onClick={() => { setProfileOpen(false); setFeedbackText(''); setFeedbackSent(false); setShowFeedback(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors text-left"
                  >
                    <MessageSquarePlus className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="text-sm font-medium text-neutral-700">Send feedback</span>
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
    </header>

    {/* Feedback modal */}
    {showFeedback && (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-6 sm:pb-0">
        <div className="bg-white rounded-2xl px-5 py-5 w-full max-w-sm relative">
          <button onClick={() => setShowFeedback(false)}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full text-stone-400 hover:text-neutral-700 hover:bg-stone-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
          {feedbackSent ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-3xl">💙</p>
              <p className="font-bold text-neutral-900 text-lg">You're the best</p>
              <p className="text-sm text-stone-400 leading-relaxed">We read every single message.<br/>This really helps us improve.</p>
              <button onClick={() => setShowFeedback(false)} className="mt-4 px-6 py-2.5 btn-primary text-white text-sm font-semibold rounded-xl">Close</button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="font-bold text-neutral-900 text-lg mb-1">We love feedback 💬</p>
                <p className="text-sm text-stone-400 leading-relaxed">Seriously — every message gets read. Tell us what&rsquo;s working, what&rsquo;s broken, or what you wish existed.</p>
              </div>
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                placeholder="What's on your mind?" rows={4}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 placeholder:text-stone-300 focus:outline-none focus:border-[#2B8FFF] resize-none" />
              <button
                disabled={!feedbackText.trim() || sendingFeedback}
                onClick={async () => {
                  if (!feedbackText.trim()) return;
                  setSendingFeedback(true);
                  try {
                    const p = JSON.parse(localStorage.getItem('mutua_profile') ?? 'null');
                    await fetch('/api/feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: feedbackText.trim(), sessionId: p?.session_id ?? '', name: name }),
                    });
                  } catch { /* best effort */ }
                  setSendingFeedback(false);
                  setFeedbackSent(true);
                }}
                className="mt-3 w-full py-3 btn-primary text-white font-semibold text-sm rounded-xl disabled:opacity-40"
              >
                {sendingFeedback ? 'Sending…' : 'Send it →'}
              </button>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}

export function BottomNav() {
  const { pathname, hasRematchBadge } = useNavState();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-stone-200/60 flex items-center">
      {BOTTOM_NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match.some(p => pathname === p || pathname.startsWith(p + '/'));
        const showDot = href === '/history' && hasRematchBadge;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              active ? 'text-neutral-900' : 'text-stone-400'
            }`}
          >
            <span className="relative">
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
              {showDot && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </span>
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
