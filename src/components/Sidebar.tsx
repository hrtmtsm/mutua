'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { User, ArrowLeftRight, TrendingUp, Bell } from 'lucide-react';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { supabase, getMessages, type Message } from '@/lib/supabase';

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

function MessagesPanel({ onOpen }: { onOpen: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [matchId, setMatchId]   = useState<string | null>(null);
  const [myId, setMyId]         = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('Partner');

  useEffect(() => {
    const sessionId = localStorage.getItem('mutua_session_id');
    if (!sessionId) return;
    setMyId(sessionId);

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

      // realtime
      supabase
        .channel(`sidebar:messages:${match.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `match_id=eq.${match.id}`,
        }, payload => setMessages(prev => [...prev, payload.new as Message]))
        .subscribe();
    }
    load();
  }, []);

  if (messages.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm font-semibold text-neutral-900 mb-1">No messages</p>
        <p className="text-xs text-stone-400 leading-relaxed">
          Messages from your exchange partners will appear here.
        </p>
      </div>
    );
  }

  const last = messages[messages.length - 1];
  return (
    <div className="divide-y divide-stone-100">
      <button onClick={onOpen} className="w-full px-4 py-3 text-left hover:bg-stone-50 transition-colors">
        <p className="text-xs font-semibold text-neutral-900 mb-0.5">{partnerName}</p>
        <p className="text-xs text-stone-400 truncate">
          {last.sender_id === myId ? 'You: ' : ''}{last.text}
        </p>
      </button>
    </div>
  );
}

export default function TopNav() {
  const { pathname, initials, avatarBg, hasUnread } = useNavState();
  const router = useRouter();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<'notifications' | 'messages'>('notifications');
  const inboxRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (inboxRef.current && !inboxRef.current.contains(e.target as Node)) {
        setInboxOpen(false);
      }
    }
    if (inboxOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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

        {/* Right side: inbox icon + profile avatar */}
        <div className="flex items-center gap-3 shrink-0" ref={inboxRef}>

          {/* Notification toggle */}
          <button
            onClick={() => setInboxOpen(o => !o)}
            className="relative p-1.5 text-stone-400 hover:text-neutral-700 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>

          {/* Notifications / Messages dropdown */}
          {inboxOpen && (
            <div className="absolute top-14 right-4 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden z-30">
              {/* Tabs */}
              <div className="flex border-b border-stone-100">
                {(['notifications', 'messages'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setInboxTab(tab)}
                    className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${
                      inboxTab === tab
                        ? 'text-neutral-900 border-b-2 border-neutral-900'
                        : 'text-stone-400 hover:text-neutral-700'
                    }`}
                  >
                    {tab === 'notifications' ? 'Notifications' : 'Messages'}
                  </button>
                ))}
              </div>

              {inboxTab === 'notifications' ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-neutral-900 mb-1">No notifications</p>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    We'll let you know when your session is confirmed or your partner reaches out.
                  </p>
                </div>
              ) : (
                <MessagesPanel onOpen={() => {
                  setInboxOpen(false);
                  localStorage.setItem('mutua_open_message', '1');
                  router.push('/app');
                }} />
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
