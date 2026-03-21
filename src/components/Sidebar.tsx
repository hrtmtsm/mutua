'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, User, CalendarDays, Clock, MessageSquare } from 'lucide-react';
import { LANG_AVATAR_COLOR } from '@/lib/constants';

const NAV = [
  {
    href: '/app',
    label: 'Session',
    icon: CalendarDays,
    match: ['/app', '/match-result', '/find-match', '/partners', '/session-confirmed', '/session-schedule', '/pre-session', '/session'],
  },
  {
    href: '/history',
    label: 'History',
    icon: Clock,
    match: ['/history'],
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: MessageSquare,
    match: ['/messages'],
  },
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

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-stone-100">
      <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center h-14">

        {/* Wordmark */}
        <Link href="/app" className="font-serif font-black text-xl tracking-tight text-neutral-900 shrink-0">
          Mutua
        </Link>

        {/* Nav links — desktop only */}
        <nav className="hidden md:flex items-center gap-1 flex-1 ml-8">
          {NAV.map(({ href, label, match }) => {
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

        {/* Right side: bell + profile avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/notifications" className="relative p-1.5 text-stone-400 hover:text-neutral-700 transition-colors">
            <Bell className="w-5 h-5" />
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </Link>
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-stone-100 flex items-center safe-area-pb">
      {NAV.map(({ href, label, icon: Icon, match }) => {
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
