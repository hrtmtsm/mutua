'use client';

// TEMPORARY TEST PAGE — delete before launch
// Navigate to /test-call to jump straight into a call session

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TestCallPage() {
  const router = useRouter();

  useEffect(() => {
    // Inject fake partner so pre-session page has data to work with
    localStorage.setItem('mutua_current_partner', JSON.stringify({
      partner_id:        'test-partner',
      name:              'Test Partner',
      native_language:   'Japanese',
      learning_language: 'English',
      goal:              'Casual conversation',
      comm_style:        'Video call',
      practice_frequency: 'Once a week',
      saved_at:          new Date().toISOString(),
    }));
    router.replace('/pre-session');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-stone-400">Setting up test call...</p>
    </div>
  );
}
