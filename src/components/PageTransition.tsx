'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const directionRef = useRef<'push' | 'pop'>('push');

  useEffect(() => {
    const handlePop = () => { directionRef.current = 'pop'; };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const cls = directionRef.current === 'pop' ? 'page-pop-in' : 'page-push-in';
  directionRef.current = 'push'; // reset for next navigation

  return (
    <div key={pathname} className={cls}>
      {children}
    </div>
  );
}
