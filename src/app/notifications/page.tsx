'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { markPop } from '@/lib/navigation';
import { supabase, getNotifications, markNotificationsSeen, type AppNotification } from '@/lib/supabase';
import { LANG_AVATAR_COLOR } from '@/lib/constants';
import { BottomNav } from '@/components/Sidebar';
import { useLocale } from '@/components/LocaleProvider';
import type { DictionaryKey } from '@/lib/i18n/dictionary';

function timeAgo(iso: string, t: (key: DictionaryKey) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return t('sidebar.agoJustNow');
  if (m < 60) return t('sidebar.agoMinutes').replace('{n}', String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t('sidebar.agoHours').replace('{n}', String(h));
  const d = Math.floor(h / 24);
  return t('sidebar.agoDays').replace('{n}', String(d));
}

function NotificationRow({ n, myId }: { n: AppNotification; myId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const ini = n.actor_name
    ? n.actor_name.trim().split(/\s+/).map((p, i, a) => i === 0 || i === a.length - 1 ? p[0] : '').join('').toUpperCase()
    : '?';

  const handleTap = () => {
    if (n.link) router.push(n.link);
  };

  return (
    <button
      onClick={handleTap}
      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-stone-50 active:bg-stone-100 transition-colors text-left border-b border-stone-100 last:border-0"
    >
      {/* Avatar */}
      {n.actor_avatar
        ? <img src={n.actor_avatar} alt={n.actor_name ?? ''} className="w-11 h-11 rounded-full object-cover shrink-0" />
        : <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-black bg-[#171717]">{ini}</div>
      }

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!n.seen ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>
          {n.body}
        </p>
        <p className="text-xs text-stone-400 mt-0.5">{timeAgo(n.created_at, t)}</p>
      </div>

      {/* Unread dot */}
      {!n.seen && <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />}
    </button>
  );
}

export default function NotificationsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState('');

  useEffect(() => {
    const sessionId = localStorage.getItem('mutua_session_id') ?? '';
    setMyId(sessionId);
    if (!sessionId) { setLoading(false); return; }

    async function load() {
      const notifs = await getNotifications(sessionId);
      setNotifications(notifs);
      await markNotificationsSeen(sessionId);
      localStorage.removeItem('mutua_unread_notification');
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
        <span className="font-serif font-bold text-xl text-neutral-900">{t('nav.titleNotifications')}</span>
      </header>

      <main className="flex-1 pb-24">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center px-4">
            <p className="text-sm font-semibold text-neutral-900 mb-1">{t('sidebar.noNotificationsTitle')}</p>
            <p className="text-xs text-stone-400 leading-relaxed">
              {t('notifications.emptyBody')}
            </p>
          </div>
        ) : (
          <div>
            {notifications.map(n => (
              <NotificationRow key={n.id} n={n} myId={myId} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
