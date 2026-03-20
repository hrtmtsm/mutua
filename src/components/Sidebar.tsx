'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, User } from 'lucide-react';
const LANG_COLORS: Record<string, string> = {
  Japanese: '#3b82f6', Korean: '#8b5cf6', Mandarin: '#ef4444',
  Spanish: '#f59e0b', French: '#10b981', English: '#6366f1',
  Portuguese: '#f97316', German: '#64748b', Italian: '#ec4899', Arabic: '#14b8a6',
};

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
  const [initials, setInitials]     = useState('');
  const [avatarBg, setAvatarBg]     = useState('#171717');
  const [hasUnread, setHasUnread]   = useState(false);

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
      setAvatarBg(LANG_COLORS[lang] ?? '#171717');
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
            <Bell className="w-5 h-5" />
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </Link>

          {/* Profile avatar */}
          <Link href="/profile" style={{ backgroundColor: avatarBg }} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity">
            {initials || (
              <User className="w-4 h-4" />
            )}
          </Link>

        </div>

      </div>
    </header>
  );
}
