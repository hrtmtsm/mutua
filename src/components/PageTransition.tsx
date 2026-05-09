'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Tab routes never animate — switching between them should feel instant
const TAB_ROUTES = ['/app', '/exchanges', '/history', '/settings'];
const isTab = (p: string) => TAB_ROUTES.some(r => p === r || p.startsWith(r + '/'));

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  const directionRef = useRef<'push' | 'pop'>('push');
  const [showExitOverlay, setShowExitOverlay] = useState(false);
  const needsExitRef = useRef(false);

  useEffect(() => {
    const handlePop = () => { directionRef.current = 'pop'; };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Compute animation before updating refs
  const prevPath = prevPathnameRef.current;
  const pathnameChanged = prevPath !== pathname;
  const isTabSwitch = isTab(prevPath) && isTab(pathname);
  const direction = directionRef.current;

  if (pathnameChanged) {
    if (!isTabSwitch && direction === 'pop') {
      needsExitRef.current = true;
    }
    prevPathnameRef.current = pathname;
    directionRef.current = 'push';
  }

  // Trigger exit overlay before paint so there's no flash of the new page
  useLayoutEffect(() => {
    if (needsExitRef.current) {
      needsExitRef.current = false;
      setShowExitOverlay(true);
    }
  }, [pathname]);

  // Push: slide in from right. Pop: no enter animation — exit overlay handles it.
  const enterCls =
    !pathnameChanged || isTabSwitch ? '' :
    direction === 'push' ? 'page-push-in' : '';

  return (
    <>
      <div key={pathname} className={enterCls}>
        {children}
      </div>
      {showExitOverlay && (
        <div
          className="fixed inset-0 z-50 bg-white page-pop-out pointer-events-none"
          onAnimationEnd={() => setShowExitOverlay(false)}
        />
      )}
    </>
  );
}
