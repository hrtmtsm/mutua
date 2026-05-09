'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SessionReviewPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/app'); }, [router]);
  return <div className="min-h-screen bg-white" />;
}
