'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('page-push-in');
    void el.offsetWidth; // force reflow so re-adding the class restarts animation
    el.classList.add('page-push-in');
  }, [pathname]);

  return (
    <div ref={ref} className="page-push-in">
      {children}
    </div>
  );
}
