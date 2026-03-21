'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { User, ArrowLeftRight, TrendingUp, MessageSquare } from 'lucide-react';
import { LANG_AVATAR_COLOR } from '@/lib/constants';

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

const DESKTOP_NAV = [
  ...BOTTOM_NAV,
  { href: '/messages', label: 'Messages', match: ['/messages'] },
];

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

export default function TopNav() {
  const { pathname, initials, avatarBg, hasUnread } = useNavState();
  const router = useRouter();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab,  setInboxTab]  = useState<'messages' | 'notifications'>('messages');
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

          {/* Inbox toggle */}
          <button
            onClick={() => setInboxOpen(o => !o)}
            className="relative p-1.5 text-stone-400 hover:text-neutral-700 transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>

          {/* Inbox dropdown */}
          {inboxOpen && (
            <div className="absolute top-14 right-4 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden z-30">

              {/* Tabs */}
              <div className="flex border-b border-stone-100">
                {(['messages', 'notifications'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setInboxTab(tab)}
                    className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
                      inboxTab === tab ? 'text-neutral-900 border-b-2 border-neutral-900' : 'text-stone-400'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="px-4 py-6 text-center">
                {inboxTab === 'messages' ? (
                  <>
                    <p className="text-sm font-semibold text-neutral-900 mb-1">No messages yet</p>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Direct messaging is coming soon. For now, connect in your live session.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-neutral-900 mb-1">No notifications</p>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      We'll let you know when your session is confirmed or your partner messages you.
                    </p>
                  </>
                )}
              </div>

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
