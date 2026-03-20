'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TopNav from '@/components/Sidebar';

interface Notification {
  id: string;
  message: string;
  time: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Clear unread badge
    localStorage.removeItem('mutua_unread_notification');

    // Build list from localStorage flags
    const items: Notification[] = [];
    const sessionScheduled = localStorage.getItem('mutua_last_scheduled_at');
    if (sessionScheduled) {
      items.push({
        id: 'session_scheduled',
        message: 'Your session has been scheduled.',
        time: new Date(sessionScheduled).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        }),
      });
    }
    setNotifications(items);
  }, []);

  return (
    <AppShell>
      <TopNav />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-neutral-900 transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back
        </button>

        <h1 className="font-serif font-black text-2xl text-neutral-900 mb-6">Notifications</h1>

        {notifications.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-16">No notifications yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map(n => (
              <div key={n.id} className="flex items-start gap-4 px-4 py-4 bg-white border border-stone-100 rounded-2xl">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{n.message}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
