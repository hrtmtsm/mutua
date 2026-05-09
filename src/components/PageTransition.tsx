'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import { consumePop, markPop } from '@/lib/navigation';

const TAB_ROUTES = ['/app', '/exchanges', '/history', '/settings'];
const isTab = (p: string) => TAB_ROUTES.some(r => p === r || p.startsWith(r + '/'));

// Fallback: also catch browser back/forward button (not in-app arrow buttons).
// popstate fires asynchronously, but this handles the hardware/gesture case.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => markPop(), { capture: true });
}

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  const [showOverlay, setShowOverlay] = useState(false);

  // Computed synchronously during render so the class applies on the first paint.
  const prev = prevPathnameRef.current;
  const pathnameChanged = prev !== pathname;
  const isTabSwitch = isTab(prev) && isTab(pathname);
  const isPop = pathnameChanged ? consumePop() : false;

  if (pathnameChanged) {
    prevPathnameRef.current = pathname;
  }

  // Push: new page slides in from right.
  // Pop: no enter animation — white overlay slides out to reveal previous page.
  const enterCls = pathnameChanged && !isTabSwitch && !isPop ? 'page-push-in' : '';

  useLayoutEffect(() => {
    if (isPop && !isTabSwitch) {
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
