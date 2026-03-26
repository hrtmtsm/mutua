'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initAnalytics, identifyUser, trackPageview } from '@/lib/analytics';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
    const sid = localStorage.getItem('mutua_session_id');
    if (sid) {
      const raw = localStorage.getItem('mutua_profile');
      const profile = raw ? JSON.parse(raw) : {};
      identifyUser(sid, {
        native_language:   profile.native_language,
        learning_language: profile.learning_language,
      });
    }
  }, []);

  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

  return <>{children}</>;
}
