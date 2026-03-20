'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  {
    href: '/app',
    label: 'Session',
    match: ['/app', '/match-result', '/find-match', '/partners', '/session-confirmed', '/session-schedule', '/pre-session', '/session'],
  },
  {
    href: '/history',
    label: 'History',
    match: ['/history'],
  },
  {
    href: '/messages',
    label: 'Messages',
    match: ['/messages'],
  },
];

export default function TopNav() {
  const pathname = usePathname();
  const [initials, setInitials] = useState('');
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
    }
    setHasUnread(!!localStorage.getItem('mutua_unread_notification'));
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-stone-100">
      <div className="max-w-5xl mx-auto px-6 flex items-center h-14 gap-8">

        {/* Wordmark */}
        <Link href="/app" className="font-serif font-black text-xl tracking-tight text-neutral-900 shrink-0">
          Mutua
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
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

        {/* Right side: notification bell + profile avatar */}
        <div className="flex items-center gap-3 shrink-0">

          {/* Bell */}
          <Link href="/notifications" className="relative p-1.5 text-stone-400 hover:text-neutral-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </Link>

          {/* Profile avatar */}
          <Link href="/profile" className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity">
            {initials || (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </Link>

        </div>

      </div>
    </header>
  );
}
