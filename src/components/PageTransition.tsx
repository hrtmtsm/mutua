'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const directionRef = useRef<'push' | 'pop'>('push');

  // popstate fires when router.back() / browser back is used
  useEffect(() => {
    const handlePop = () => { directionRef.current = 'pop'; };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cls = directionRef.current === 'pop' ? 'page-pop-in' : 'page-push-in';
    directionRef.current = 'push'; // reset for next navigation
    el.classList.remove('page-push-in', 'page-pop-in');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add(cls);
  }, [pathname]);

  return (
    <div ref={ref} className="page-push-in">
      {children}
    </div>
  );
}
