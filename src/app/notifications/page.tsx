'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

interface NotificationItem {
  type: string;
  partnerName: string;
  scheduledAt: string;
}

export default function NotificationsPage() {
  const [notification, setNotification] = useState<NotificationItem | null>(null);

  useEffect(() => {
    localStorage.removeItem('mutua_unread_notification');
    const raw = localStorage.getItem('mutua_last_notification');
    if (raw) setNotification(JSON.parse(raw));
  }, []);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-serif font-black text-2xl text-neutral-900 mb-6">Notifications</h1>

        {!notification ? (
          <p className="text-sm text-stone-400 text-center py-16">No notifications yet.</p>
        ) : (
          <Link href="/app" className="flex items-start gap-4 px-4 py-4 bg-white border border-stone-100 rounded-2xl hover:bg-stone-50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Your exchange with {notification.partnerName} is scheduled
              </p>
              <p className="text-xs text-stone-400 mt-0.5">{fmtTime(notification.scheduledAt)}</p>
            </div>
          </Link>
        )}
      </div>
    </AppShell>
  );
}
