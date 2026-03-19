'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MatchResultPage() {
  const router = useRouter();

  useEffect(() => {
    const sessionId = localStorage.getItem('mutua_session_id');
    if (!sessionId) { router.replace('/onboarding'); return; }
    router.replace('/app');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#2B8FFF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
