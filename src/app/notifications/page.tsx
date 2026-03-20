'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { CheckCircle2 } from 'lucide-react';

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
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
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
