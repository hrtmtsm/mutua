'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Detects Supabase implicit-flow auth hashes on the root page
 * (e.g. password reset links that land on / instead of /auth/callback)
 * and forwards them to /auth/callback so the existing handler can process them.
 */
export default function AuthRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      // Preserve the full hash so /auth/callback can read it
      router.replace('/auth/callback' + hash);
    }
  }, [router]);

  return null;
}
