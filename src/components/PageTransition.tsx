'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import { consumePop, markPop, peekPop } from '@/lib/navigation';

const TAB_ROUTES = ['/app', '/exchanges', '/history', '/settings'];
const isTab = (p: string) => TAB_ROUTES.some(r => p === r || p.startsWith(r + '/'));

// Fallback for browser back gesture / hardware button (popstate fires after re-render,
// but capture phase still runs before Next.js processes the route change).
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => markPop(), { capture: true });
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevRef  = useRef(pathname);
  const [showOverlay, setShowOverlay] = useState(false);

  // Read pendingPop WITHOUT consuming — safe in concurrent mode because React
  // may render multiple times before committing. We consume in useLayoutEffect.
  const prev    = prevRef.current;
  const changed = prev !== pathname;
  const isTabSwitch = isTab(prev) && isTab(pathname);
  const isPop   = changed && peekPop();

  if (changed) prevRef.current = pathname;

  // Push: slide new page in from right. Pop: no enter animation.
  const enterCls = changed && !isTabSwitch && !isPop ? 'page-push-in' : '';

  useLayoutEffect(() => {
    // Safe to consume here — runs exactly once after React commits.
    const wasPop = peekPop();
    consumePop();
    if (wasPop && !isTabSwitch) {
      setShowOverlay(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <div key={pathname} className={enterCls}>
        {children}
      </div>
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 bg-white page-pop-out pointer-events-none"
          onAnimationEnd={() => setShowOverlay(false)}
        />
      )}
    </>
  );
}
